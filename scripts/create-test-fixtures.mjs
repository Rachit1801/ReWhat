import { mkdir, writeFile } from 'node:fs/promises';
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js/index-native.js';
const folder = new URL('../.local/', import.meta.url);
await mkdir(folder, { recursive: true });
async function writeZip(name, entries) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [path, contents] of Object.entries(entries)) await writer.add(path, typeof contents === 'string' ? new TextReader(contents) : new Uint8ArrayReader(contents));
  await writeFile(new URL(name, folder), new Uint8Array(await (await writer.close()).arrayBuffer()));
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
const rate = 8000; const count = rate * 2;
const wav = new Uint8Array(44 + count * 2); const view = new DataView(wav.buffer);
function ascii(offset, value) { [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0))); }
ascii(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); ascii(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, count * 2, true);
for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.sin(i / rate * Math.PI * 440 * 2) * 2000, true);
await writeZip('media.zip', {
  '_chat.txt': '[17/03/2026, 14:00:00] Alex: <attached: pixel.png>\nA tiny photo\n[17/03/2026, 14:01:00] You: <attached: animation.gif>\n[17/03/2026, 14:02:00] Alex: <attached: STK-sticker.webp>\n[17/03/2026, 14:03:00] You: <attached: tone.wav>\n[17/03/2026, 14:04:00] Alex: <attached: unsupported.mp4>\n[17/03/2026, 14:05:00] You: <attached: notes.pdf>\n[17/03/2026, 14:06:00] Alex: <attached: missing.jpg>\n[17/03/2026, 14:07:00] You: <Media omitted>\n[17/03/2026, 14:08:00] Alex: *Everything* stays _here_.\n<script>alert("unsafe")</script>\nhttps://example.com',
  'pixel.png': png, 'animation.gif': gif, 'STK-sticker.webp': webp, 'tone.wav': wav,
  'unsupported.mp4': 'Intentional invalid codec fixture', 'notes.pdf': '%PDF-1.4\nSynthetic download fixture\n%%EOF',
});
await writeZip('ambiguous.zip', { '_chat.txt': '03/04/26, 10:00 am - Alex: First\n04/05/26, 10:01 am - You: Second' });
await writeZip('multiple.zip', { '_chat.txt': '[17/03/26, 14:00] Alex: Chat one', 'another.txt': '17/03/26, 2:00 pm - Bea: Chat two', 'notes.txt': 'Unrelated notes' });
await writeZip('large.zip', { '_chat.txt': Array.from({ length: 100_000 }, (_, i) => `17/03/26, 12:00 - ${i % 2 ? 'You' : 'Alex'}: Message ${i}`).join('\n') });
await writeFile(new URL('corrupt.zip', folder), 'Not a ZIP');
console.log('Created synthetic fixtures in .local. These files are ignored and excluded from publication.');
