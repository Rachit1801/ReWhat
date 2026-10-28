import { describe, expect, it } from 'vitest';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js/index-native.js';
import { ChatArchive } from '../src/lib/archive';
import { parseTranscript } from '../src/lib/parser';
async function zip(files: Record<string, string>) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [name, text] of Object.entries(files)) await writer.add(name, new TextReader(text));
  return writer.close();
}
describe('browser-local ZIP reading', () => {
  it('finds and reconstructs a transcript and reads only requested media', async () => {
    const archive = new ChatArchive();
    try {
      const result = await archive.open(await zip({ '_chat.txt': '[17/03/26, 14:00:00] Alex: <attached: picture.jpg>\nCaption', 'picture.jpg': 'synthetic image bytes' }));
      expect(result.transcripts).toHaveLength(1);
      const chat = parseTranscript(await archive.readText(result.transcripts[0].id), archive.entries);
      const blob = await archive.readMedia(chat.messages[0].attachments[0].entryId!);
      expect(await blob.text()).toBe('synthetic image bytes');
      expect(blob.type).toBe('image/jpeg');
    } finally { await archive.close(); }
  });
  it('offers multiple transcripts and skips unrelated text', async () => {
    const archive = new ChatArchive();
    try {
      const result = await archive.open(await zip({ 'one.txt': '17/03/26, 2:00 pm - Alex: One', 'two.txt': '17/03/26, 2:00 pm - Bea: Two', 'notes.txt': 'Not a conversation' }));
      expect(result.transcripts).toHaveLength(2);
    } finally { await archive.close(); }
  });
  it('handles no transcript and corrupt ZIPs with readable errors', async () => {
    const archive = new ChatArchive();
    await expect(archive.open(await zip({ 'notes.txt': 'Nothing here' }))).rejects.toThrow('No WhatsApp transcript');
    await archive.close();
    const invalid = new ChatArchive();
    await expect(invalid.open(new Blob(['invalid']))).rejects.toThrow();
    await invalid.close();
  });
  it('does not keep media references after closing', async () => {
    const archive = new ChatArchive();
    await archive.open(await zip({ '_chat.txt': '17/03/26, 2:00 pm - Alex: Hello' }));
    await archive.close();
    expect(archive.entries).toHaveLength(0);
    await expect(archive.readMedia('1')).rejects.toThrow('not available');
  });
});
