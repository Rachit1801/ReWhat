import { describe, expect, it } from 'vitest';
import { isGrouped, parseVcards, richContent } from '../src/lib/message-content';
import { parseTranscript } from '../src/lib/parser';

describe('WhatsApp message cards', () => {
  it('recognizes view-once voice and video-note placeholders without changing ordinary text', () => {
    expect(richContent('<View once voice message omitted>')).toMatchObject({ kind: 'omitted', label: 'View Once message' });
    expect(richContent('\u200e<Video note omitted>')).toMatchObject({ kind: 'omitted', label: 'Video note' });
    expect(richContent('I received <Video note omitted> earlier')).toBeNull();
  });
  it('extracts multi-line polls, singular/plural votes, and unavailable counts', () => {
    expect(richContent('POLL:\nTest Poll\nOPTION: 1 (1 vote)\nOPTION: 2 (2 votes)\nOPTION: Other')).toEqual({ kind: 'poll', title: 'Test Poll', options: [{ label: '1', votes: 1 }, { label: '2', votes: 2 }, { label: 'Other', votes: null }] });
    expect(richContent('POLL: just a sentence')).toBeNull();
  });
  it('converts event milliseconds and seconds; preserves cancellation and multiline descriptions', () => {
    const event = 'EVENT: Test\nEvent Start time: 1793257200000\nEvent Cancelled: true\nEvent Description: Bring a laptop\nAnd a charger';
    expect(richContent(event)).toEqual({ kind: 'event', title: 'Test', start: 1793257200000, cancelled: true, description: 'Bring a laptop\nAnd a charger', going: null });
    expect(richContent(event.replace('1793257200000', '1793257200'))).toMatchObject({ start: 1793257200000 });
    expect(richContent(event.replace('1793257200000', 'invalid'))).toMatchObject({ start: null });
  });
  it('splits groups after five minutes, handles noon/midnight, sender changes and notices', () => {
    const chat = parseTranscript('17/03/26, 11:59 am - You: A\n17/03/26, 12:00 pm - You: B\n17/03/26, 12:05 pm - You: C\n17/03/26, 12:06 pm - Alex: D\n17/03/26, 12:07 pm - Notice\n17/03/26, 12:08 pm - Alex: E');
    expect(chat.messages.map((message, i) => isGrouped(message, chat.messages[i - 1]))).toEqual([false, true, false, false, false, false]);
    const midnight = parseTranscript('17/03/26, 11:59 pm - You: A\n18/03/26, 12:00 am - You: B');
    expect(isGrouped(midnight.messages[1], midnight.messages[0])).toBe(false);
  });
  it('reads multiple vCards, folded fields, escaped names, phone labels and embedded photos', () => {
    const contacts = parseVcards('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Alex\\,\r\n Smith\r\nTEL;TYPE=HOME:+123456789\r\nPHOTO;ENCODING=b;TYPE=JPEG:aGVsbG8=\r\nEND:VCARD\r\nBEGIN:VCARD\r\nN:Jones;Sam;;;\r\nTEL;TYPE=CELL:tel:+987654321\r\nPHOTO;VALUE=URI:https://example.com/private.jpg\r\nEND:VCARD');
    expect(contacts).toEqual([{ name: 'Alex,Smith', phones: [{ number: '+123456789', label: 'Home' }], photo: 'data:image/jpeg;base64,aGVsbG8=' }, { name: 'Sam Jones', phones: [{ number: '+987654321', label: 'Mobile' }], photo: undefined }]);
  });
});
