import { expect, test } from '@playwright/test';
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js/index-native.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('WhatsApp cards, media controls, deduplication and responsive layout', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1550 });
  await page.goto('/');
  await expect(page).toHaveTitle('ReWhat');
  const media = await page.evaluate(async () => {
    const record = async (stream: MediaStream, mimeType: string) => {
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => chunks.push(event.data);
      const stopped = new Promise<Blob>(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType })); });
      recorder.start();
      await new Promise(resolve => setTimeout(resolve, mimeType.startsWith('audio') ? 2500 : 1500));
      recorder.stop();
      const result = Array.from(new Uint8Array(await (await stopped).arrayBuffer()));
      stream.getTracks().forEach(track => track.stop());
      return result;
    };
    const context = new AudioContext();
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = .05;
    oscillator.connect(gain).connect(destination); oscillator.start();
    const audio = await record(destination.stream, 'audio/webm;codecs=opus');
    oscillator.stop(); await context.close();
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 240;
    const drawing = canvas.getContext('2d')!;
    drawing.fillStyle = '#4f7a72'; drawing.fillRect(0, 0, 180, 240);
    drawing.fillStyle = '#f5ebcf'; drawing.font = '20px sans-serif'; drawing.fillText('Video preview', 20, 120);
    let frame = 0;
    const animation = setInterval(() => { drawing.fillStyle = '#4f7a72'; drawing.fillRect(0, 160, 180, 80); drawing.fillStyle = '#f5ebcf'; drawing.fillRect(frame++ % 150, 190, 20, 20); }, 50);
    const video = await record(canvas.captureStream(10), 'video/webm;codecs=vp8');
    clearInterval(animation);
    return { audio, video, png: canvas.toDataURL('image/png').split(',')[1] };
  });
  const transcript = `17/03/26, 2:30 pm - You: First group
17/03/26, 2:31 pm - You: Same group
17/03/26, 4:42 pm - You: New group
17/03/26, 4:43 pm - You: <View once voice message omitted>
17/03/26, 4:43 pm - You: <Video note omitted>
17/03/26, 4:44 pm - You: photo.png (file attached)
<attached: photo.png>
17/03/26, 4:44 pm - You: photo.png (file attached)
17/03/26, 4:45 pm - You: PTT-voice.opus (file attached)
17/03/26, 4:45 pm - You: AUD-recording.wav (file attached)
17/03/26, 4:46 pm - You: video.webm (file attached)
17/03/26, 4:46 pm - You: GIF-animation.webm (file attached)
17/03/26, 4:47 pm - You: 2 contacts.vcf (file attached)
17/03/26, 4:48 pm - You: POLL:
Test Poll
OPTION: 1 (1 vote)
OPTION: 2 (1 vote)
17/03/26, 4:48 pm - You: EVENT: Test
Event Start time: 1793257200000
Event Cancelled: false
Event Description: A local event description
17/03/26, 4:49 pm - Alex: End of fixture`;
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  await writer.add('_chat.txt', new TextReader(transcript));
  await writer.add('photo.png', new Uint8ArrayReader(Buffer.from(media.png, 'base64')));
  await writer.add('PTT-voice.opus', new Uint8ArrayReader(new Uint8Array(media.audio)));
  // A small PCM recording checks the separate audio-file presentation.
  const wav = new Uint8Array(44 + 16000); const view = new DataView(wav.buffer);
  const ascii = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); ascii(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, 16000, true);
  await writer.add('AUD-recording.wav', new Uint8ArrayReader(wav));
  await writer.add('video.webm', new Uint8ArrayReader(new Uint8Array(media.video)));
  await writer.add('GIF-animation.webm', new Uint8ArrayReader(new Uint8Array(media.video)));
  await writer.add('2 contacts.vcf', new TextReader('BEGIN:VCARD\nVERSION:3.0\nFN:Alex\nTEL;TYPE=HOME:+123456789\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nFN:Sam Jones\nTEL;TYPE=CELL:+987654321\nEND:VCARD'));
  const zip = Buffer.from(await (await writer.close()).arrayBuffer());
  await mkdir('.local', { recursive: true });
  await writeFile(path.resolve('.local/cards.zip'), zip);
  await page.locator('input[type=file]').setInputFiles({ name: 'cards.zip', mimeType: 'application/zip', buffer: zip });
  await page.getByRole('button', { name: 'You', exact: true }).click();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('.poll-card')).toContainText('Test Poll');
  await expect(page.locator('.event-card')).toContainText('29 Oct 2026');
  await expect(page.locator('.event-card')).not.toContainText('1793257200000');
  await expect(page.locator('.omitted-message em')).toHaveText(['View Once message', 'Video note']);
  await expect(page.getByRole('button', { name: 'Enlarge photo.png', exact: true })).toHaveCount(1);
  await expect(page.locator('.contact-card')).toContainText('Alex and 1 other contact');
  await page.getByRole('button', { name: 'View all', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Sam Jones');
  await expect(page.getByRole('dialog')).toContainText('+123456789');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'View votes', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.poll-results')).toContainText('1 vote');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'View event', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('A local event description');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const voice = page.locator('.voice-message audio');
  await page.getByRole('button', { name: 'Play voice message', exact: true }).click();
  await expect.poll(() => voice.evaluate(el => (el as HTMLAudioElement).paused)).toBe(false);
  await expect(page.getByRole('button', { name: 'Change playback speed' })).toBeVisible();
  await page.getByRole('button', { name: 'Change playback speed' }).click();
  expect(await voice.evaluate(el => (el as HTMLAudioElement).playbackRate)).toBe(1.5);
  await page.getByRole('button', { name: 'Pause voice message', exact: true }).click();
  await expect(page.locator('.voice-message input[type=range]')).toHaveAttribute('max', /[1-9]/);
  await page.getByRole('slider', { name: 'Seek voice message', exact: true }).fill('0.2');
  expect(await voice.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(.1);
  await expect.poll(() => page.locator('.gif-attachment video').evaluate(el => (el as HTMLVideoElement).paused)).toBe(false);
  await page.getByRole('button', { name: 'Play video video.webm', exact: true }).click();
  const video = page.getByRole('dialog').locator('video');
  await expect(video).toHaveAttribute('controls', '');
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).paused)).toBe(false);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const grouped = page.locator('.message-row').filter({ hasText: 'Same group' });
  await expect(grouped).toHaveClass(/grouped/);
  await expect(page.locator('.message-row').filter({ hasText: 'New group' })).not.toHaveClass(/grouped/);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: path.resolve('test-results/cards-desktop.png') });
  await page.locator('.event-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.resolve('test-results/cards-desktop-details.png') });
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await page.locator('.conversation-scroll').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.event-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.resolve('test-results/cards-mobile.png') });
  await page.getByRole('button', { name: 'Chat options', exact: true }).click();
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await page.screenshot({ path: path.resolve('test-results/cards-light.png') });
  expect(errors).toEqual([]);
});
