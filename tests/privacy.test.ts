import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js/index-native.js';
import { ChatArchive } from '../src/lib/archive';
import { parseTranscript } from '../src/lib/parser';
import { MediaStore } from '../src/lib/media-store';

afterEach(() => vi.unstubAllGlobals());
describe('privacy and resource lifecycle', () => {
  it('imports, maps and extracts media with all network calls disabled', async () => {
    const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
    await writer.add('_chat.txt', new TextReader('17/03/26, 12:00 - Alex: photo.jpg (file attached)\nCaption'));
    await writer.add('photo.jpg', new TextReader('local bytes'));
    const zip = await writer.close();
    const network = vi.fn(() => { throw new Error('Network forbidden'); });
    vi.stubGlobal('fetch', network);
    vi.stubGlobal('XMLHttpRequest', network);
    vi.stubGlobal('WebSocket', network);
    const archive = new ChatArchive();
    try {
      const result = await archive.open(zip);
      const chat = parseTranscript(await archive.readText(result.transcripts[0].id), archive.entries);
      expect(chat.messages[0].text).toBe('Caption');
      expect(await (await archive.readMedia(chat.messages[0].attachments[0].entryId!)).text()).toBe('local bytes');
      expect(network).not.toHaveBeenCalled();
    } finally { await archive.close(); }
  });
  it('shares pending media reads and revokes every object URL on clear', async () => {
    const load = vi.fn(async () => new Blob(['local image']));
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const store = new MediaStore(load);
    const [first, second] = await Promise.all([store.acquire('photo'), store.acquire('photo')]);
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);
    store.release('photo'); store.release('photo'); store.dispose();
    expect(revoke).toHaveBeenCalledWith(first);
    await expect(store.acquire('photo')).rejects.toThrow('closed');
    revoke.mockRestore();
  });
  it('does not retain a pending attachment after clearing the session', async () => {
    let finish!: (blob: Blob) => void;
    const store = new MediaStore(() => new Promise(resolve => { finish = resolve; }));
    const pending = store.acquire('photo');
    store.dispose(); finish(new Blob(['data']));
    await expect(pending).rejects.toThrow('closed');
  });
  it('parses 100,000 messages without dropping or reordering records', () => {
    const text = Array.from({ length: 100_000 }, (_, i) => `17/03/26, 12:00 - ${i % 2 ? 'You' : 'Alex'}: Message ${i}`).join('\n');
    const start = performance.now();
    const chat = parseTranscript(text);
    expect(chat.messages.length).toBe(100_000);
    expect(chat.messages.at(-1)?.text).toBe('Message 99999');
    expect(chat.messages.every((message, index) => message.sourceIndex === index)).toBe(true);
    expect(performance.now() - start).toBeLessThan(15_000);
  });
});
