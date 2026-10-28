import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js/index-native.js';
import type { Entry, FileEntry } from '@zip.js/zip.js';
import { looksLikeTranscript, mediaType } from './parser';
import type { ArchiveEntry, OpenResult } from './types';

// Extract one entry at a time. Limits also apply to actual decompressed bytes.
export const LIMITS = { archive: 1024 ** 3, transcript: 32 * 1024 ** 2, media: 256 * 1024 ** 2, entries: 25_000 };
export class ChatArchive {
  private reader?: ZipReader<Blob>;
  private files = new Map<string, FileEntry>();
  entries: ArchiveEntry[] = [];
  private controller = new AbortController();
  async open(file: Blob, progress = (_value: number, _label: string) => {}): Promise<OpenResult> {
    if (file.size > LIMITS.archive) throw new Error('This ZIP is larger than 1 GB. Export a smaller date range or omit media.');
    this.reader = new ZipReader(new BlobReader(file), { useWebWorkers: false });
    let count = 0;
    for await (const entry of this.reader.getEntriesGenerator()) {
      if (++count > LIMITS.entries) throw new Error('This ZIP contains too many files. Please use a smaller export.');
      if (entry.directory || entry.filename.startsWith('__MACOSX/')) continue;
      if (entry.encrypted) throw new Error('Password-protected ZIPs are not supported. Use the original WhatsApp export.');
      const id = String(count);
      this.files.set(id, entry as FileEntry);
      this.entries.push({ id, path: entry.filename, size: entry.uncompressedSize });
    }
    progress(30, 'Finding your conversation');
    const candidates = this.entries.filter(e => /\.txt$/i.test(e.path) && e.size <= LIMITS.transcript);
    const transcripts: ArchiveEntry[] = [];
    for (const entry of candidates) {
      const text = await this.readText(entry.id);
      if (looksLikeTranscript(text)) transcripts.push(entry);
    }
    if (!transcripts.length) throw new Error('No WhatsApp transcript found in this ZIP. Export a chat from WhatsApp and try again.');
    return { transcripts, fileCount: this.entries.length };
  }
  private async extract(id: string, limit: number, mime: string): Promise<Blob> {
    const entry = this.files.get(id);
    if (!entry) throw new Error('This attachment is not available in the archive.');
    if (entry.uncompressedSize > limit) throw new Error('This file is too large to open safely in the browser.');
    const abort = new AbortController();
    const cancel = () => abort.abort();
    this.controller.signal.addEventListener('abort', cancel, { once: true });
    try {
      return await entry.getData(new BlobWriter(mime), {
        signal: abort.signal, useWebWorkers: false, checkSignature: true,
        onprogress: value => { if (value > limit) abort.abort('Extracted file exceeds the size limit'); },
      });
    } finally { this.controller.signal.removeEventListener('abort', cancel); }
  }
  async readText(id: string) { return (await this.extract(id, LIMITS.transcript, 'text/plain')).text(); }
  async readMedia(id: string) {
    const entry = this.entries.find(e => e.id === id);
    return this.extract(id, LIMITS.media, mediaType(entry?.path ?? '').mime);
  }
  async close() { this.controller.abort(); await this.reader?.close(); this.entries = []; this.files.clear(); }
}
