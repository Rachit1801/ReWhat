import { describe, expect, it } from 'vitest';
import { attachmentResolver, looksLikeTranscript, mediaType, parseTranscript } from '../src/lib/parser';
import type { ArchiveEntry } from '../src/lib/types';

describe('WhatsApp transcript reconstruction', () => {
  it('preserves Android messages, multiline text, and equal-timestamp source order', () => {
    const chat = parseTranscript('17/03/26, 2:46\u202fpm - Alex: Hello\nSecond line\n\nFourth line\n17/03/26, 2:46\u202fpm - You: Hi\n17/03/26, 2:46\u202fpm - Alex: Again');
    expect(chat.messages).toHaveLength(3);
    expect(chat.messages.map(m => m.text)).toEqual(['Hello\nSecond line\n\nFourth line', 'Hi', 'Again']);
    expect(chat.messages[0]).toMatchObject({ dateKey: '2026-03-17', time: '2:46 pm', sender: 'Alex' });
    expect(chat.participants).toEqual(['Alex', 'You']);
  });
  it('supports iPhone headers, direction markers, seconds and group participants', () => {
    const chat = parseTranscript('\u200e[17/03/2026, 14:03:05] Alex: Hello\n[17/03/2026, 14:04:05] Bea: Hey\n[17/03/2026, 14:04:05] You: 👋');
    expect(chat.participants).toEqual(['Alex', 'Bea', 'You']);
    expect(chat.messages[0].time).toBe('14:03:05');
    expect(chat.title).toBe('Group conversation');
  });
  it('infers month-first dates from unambiguous records', () => {
    const chat = parseTranscript('03/17/26, 10:40 AM - Alex: Hello\n04/02/26, 9:00 AM - You: Hey');
    expect(chat.needsDateOrder).toBe(false);
    expect(chat.messages[1].dateKey).toBe('2026-04-02');
  });
  it('requires a choice for ambiguous dates and reparses without changing text/order', () => {
    const text = '03/04/26, 10:00 am - Alex: One\n04/05/26, 10:00 am - You: Two';
    expect(parseTranscript(text).needsDateOrder).toBe(true);
    expect(parseTranscript(text, [], 'dmy').messages[0].dateKey).toBe('2026-04-03');
    expect(parseTranscript(text, [], 'mdy').messages[0].dateKey).toBe('2026-03-04');
  });
  it('supports ISO, dashed and dotted dates without timezone conversion', () => {
    expect(parseTranscript('2026-10-17, 23:59 - Alex: Midnight').messages[0].dateKey).toBe('2026-10-17');
    expect(parseTranscript('17.10.26, 23:59 - Alex: Hello').messages[0].dateKey).toBe('2026-10-17');
    expect(parseTranscript('17-10-2026, 23:59 - Alex: Hello').messages[0].dateKey).toBe('2026-10-17');
  });
  it('keeps system notices, blank records and leading text', () => {
    const chat = parseTranscript('Export notes\n17/03/26, 2:00 pm - Messages are encrypted\n17/03/26, 2:01 pm - \n17/03/26, 2:02 pm - Alex: ');
    expect(chat.messages).toHaveLength(4);
    expect(chat.messages[0].dateKey).toBeNull();
    expect(chat.messages[1].sender).toBeNull();
    expect(chat.messages[2].text).toBe('');
    expect(chat.messages[3]).toMatchObject({ sender: 'Alex', text: '' });
  });
  it('preserves payment exports as their original text', () => {
    const text = 'You sent ₹80.00 to A PERSON';
    expect(parseTranscript(`17/03/26, 2:00 pm - You: ${text}`).messages[0].text).toBe(text);
  });
  it('keeps timestamp-looking invalid lines and colons in message text', () => {
    const chat = parseTranscript('17/03/26, 2:00 pm - Alex: https://example.com\n99/99/99, 99:99 - text\nYou: continuation');
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0].text).toContain('You: continuation');
  });
  it('rejects malformed input and impossible calendar dates', () => {
    expect(() => parseTranscript('not an export')).toThrow('No chat messages');
    expect(() => parseTranscript('31/02/26, 2:00 pm - Alex: Hello')).toThrow('not valid');
  });
  it('recognizes transcripts without treating arbitrary text as one', () => {
    expect(looksLikeTranscript('Notes\n17/03/26, 2:00 pm - Alex: Hello')).toBe(true);
    expect(looksLikeTranscript('some file.txt')).toBe(false);
  });
});

describe('attachment mapping', () => {
  const entries: ArchiveEntry[] = [{ id: 'one', path: 'media/IMG-1.jpg', size: 3 }, { id: 'two', path: 'STK-1.webp', size: 3 }];
  it('maps Android media and preserves the full multiline caption', () => {
    const chat = parseTranscript('17/03/26, 2:00 pm - Alex: IMG-1.jpg (file attached)\nA caption\n\nhttps://example.com', entries);
    expect(chat.messages[0].attachments[0]).toMatchObject({ entryId: 'one', kind: 'image' });
    expect(chat.messages[0].text).toBe('A caption\n\nhttps://example.com');
  });
  it('maps iPhone attachment markers and WebP stickers', () => {
    const chat = parseTranscript('[17/03/26, 14:00:00] Alex: \u200e<attached: STK-1.webp>', entries);
    expect(chat.messages[0].attachments[0]).toMatchObject({ entryId: 'two', kind: 'sticker' });
    expect(chat.messages[0].text).toBe('');
  });
  it('handles omitted media without making up attachments', () => {
    const chat = parseTranscript('17/03/26, 2:00 pm - Alex: <Media omitted>\n17/03/26, 2:01 pm - You: \u200eimage omitted');
    expect(chat.messages.map(m => m.attachments[0].unavailable)).toEqual(['omitted', 'omitted']);
  });
  it('reports missing and ambiguous files instead of guessing', () => {
    const resolve = attachmentResolver([...entries, { id: 'three', path: 'other/IMG-1.jpg', size: 4 }]);
    expect(resolve('IMG-1.jpg', 'a').unavailable).toBe('ambiguous');
    expect(resolve('media/IMG-1.jpg', 'a').entryId).toBe('one');
    expect(resolve('absent.jpg', 'a').unavailable).toBe('missing');
  });
  it('normalizes Unicode, direction markers, paths, and case for unique basenames', () => {
    const resolve = attachmentResolver([{ id: 'x', path: 'media/café.JPG', size: 2 }]);
    expect(resolve('\u200ecafe\u0301.jpg', 'a').entryId).toBe('x');
    expect(resolve('media\\café.JPG', 'a').entryId).toBe('x');
  });
  it.each([
    ['a.mp4', 'video', 'video/mp4'], ['a.opus', 'audio', 'audio/ogg; codecs=opus'],
    ['a.m4a', 'audio', 'audio/mp4'], ['a.gif', 'image', 'image/gif'],
    ['STK-a.webp', 'sticker', 'image/webp'], ['a.pdf', 'document', 'application/pdf'],
    ['a.svg', 'document', 'application/octet-stream'], ['a.unknown', 'document', 'application/octet-stream'],
  ])('classifies %s safely', (name, kind, mime) => { expect(mediaType(name)).toEqual({ kind, mime }); });
});
