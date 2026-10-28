import type { ArchiveEntry, Attachment, DateOrder, MediaKind, Message, ParsedChat } from './types';

const directional = /[\u200e\u200f\ufeff]/g;
const datePart = '(\\d{1,4}[/.\\-]\\d{1,2}[/.\\-]\\d{1,4})';
const timePart = '(\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?)';
const android = new RegExp(`^${datePart},?\\s+${timePart}\\s+[-–]\\s?(.*)$`, 'i');
const iphone = new RegExp(`^\\[${datePart},?\\s+${timePart}\\]\\s?(.*)$`, 'i');
interface RecordLine { date: string; time: string; body: string; line: number }

export function normalizePath(path: string): string {
  return path.replace(directional, '').normalize('NFC').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}
export function mediaType(filename: string): { kind: MediaKind; mime: string } {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimes: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    avif: 'image/avif', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    '3gp': 'video/3gpp', mp3: 'audio/mpeg', opus: 'audio/ogg; codecs=opus', ogg: 'audio/ogg',
    m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', pdf: 'application/pdf', txt: 'text/plain',
    vcf: 'text/vcard', zip: 'application/zip', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  const mime = mimes[ext ?? ''] ?? 'application/octet-stream';
  const kind: MediaKind = ext === 'webp' && /(?:STK-|sticker)/i.test(filename) ? 'sticker'
    : mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video'
    : mime.startsWith('audio/') ? 'audio' : 'document';
  return { kind, mime };
}

export function attachmentResolver(entries: ArchiveEntry[]) {
  const paths = new Map<string, ArchiveEntry[]>();
  const basenames = new Map<string, ArchiveEntry[]>();
  for (const entry of entries) {
    const path = normalizePath(entry.path);
    paths.set(path, [...(paths.get(path) ?? []), entry]);
    const base = path.split('/').pop()!.toLocaleLowerCase('en');
    basenames.set(base, [...(basenames.get(base) ?? []), entry]);
  }
  return (filename: string, id: string): Attachment => {
    const path = normalizePath(filename);
    const matches = paths.get(path) ?? basenames.get(path.split('/').pop()!.toLocaleLowerCase('en')) ?? [];
    return {
      id, filename: path, ...mediaType(path),
      ...(matches.length === 1 ? { entryId: matches[0].id }
        : { unavailable: matches.length ? 'ambiguous' as const : 'missing' as const }),
    };
  };
}

function header(line: string) {
  // Normalize only header syntax; preserve the message body exactly.
  const candidate = line.replace(/^[\u200e\u200f\ufeff]+/, '');
  const match = candidate.match(iphone) ?? candidate.match(android);
  if (!match) return null;
  const t = match[2].replace(/[\u202f\u00a0]/g, ' ').trim();
  const tm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?m?\.?$/i);
  if (!tm || +tm[1] > (tm[4] ? 12 : 23) || (tm[4] && +tm[1] === 0) || +tm[2] > 59 || +(tm[3] ?? 0) > 59) return null;
  const parts = match[1].split(/[/.\-]/).map(Number);
  const yearFirst = match[1].split(/[/.\-]/)[0].length === 4;
  if ((yearFirst ? parts[1] > 12 || parts[2] > 31 : parts[0] > 31 || parts[1] > 31)) return null;
  return { date: match[1], time: t.replace(/\s*([ap])\.?m\.?$/i, ' $1m').toLowerCase(), body: match[3] };
}

function stamp(date: string, time: string, order: DateOrder) {
  const segments = date.split(/[/.\-]/);
  const [a, b, c] = segments.map(Number);
  const ymd = segments[0].length === 4;
  const year = ymd ? a : c < 100 ? (c < 70 ? 2000 + c : 1900 + c) : c;
  const month = ymd ? b : order === 'dmy' ? b : a;
  const day = ymd ? c : order === 'dmy' ? a : b;
  const local = new Date(year, month - 1, day, 12);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day) {
    throw new Error(`The date ${date} is not valid for this date format.`);
  }
  return {
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    dateLabel: local.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    time, rawTimestamp: `${date}, ${time}`,
  };
}

export function looksLikeTranscript(text: string) {
  return text.split(/\r?\n/, 100).some(line => header(line));
}

export function parseTranscript(text: string, entries: ArchiveEntry[] = [], dateOrder?: DateOrder): ParsedChat {
  const records: RecordLine[] = [];
  const preamble: string[] = [];
  for (const [index, line] of text.replace(/^\ufeff/, '').split(/\r?\n/).entries()) {
    const match = header(line);
    if (match) records.push({ ...match, line: index + 1 });
    else if (records.length) records[records.length - 1].body += '\n' + line;
    else preamble.push(line);
  }
  if (!records.length) throw new Error('No chat messages found. Choose a WhatsApp chat export ZIP.');
  const orders = new Set<DateOrder>();
  let ambiguous = false;
  for (const record of records) {
    const segments = record.date.split(/[/.\-]/);
    if (segments[0].length === 4) continue;
    const [a, b] = segments.map(Number);
    if (a > 12) orders.add('dmy');
    else if (b > 12) orders.add('mdy');
    else if (a !== b) ambiguous = true;
  }
  if (orders.size > 1) throw new Error('This transcript mixes incompatible date formats. Export the chat again.');
  const chosenOrder = dateOrder ?? [...orders][0] ?? 'dmy';
  const dateCache = new Map<string, ReturnType<typeof stamp>>();
  const resolve = attachmentResolver(entries);
  const participants: string[] = [];
  const messages: Message[] = records.map((record, index) => {
    const body = record.body.replace(/\n+$/, '');
    const senderMatch = body.match(/^([^:\n]{1,160}):(?: |$)([\s\S]*)$/);
    const sender = senderMatch ? senderMatch[1].replace(directional, '').trim() : null;
    if (sender && !participants.includes(sender)) participants.push(sender);
    let message = senderMatch ? senderMatch[2] : body;
    const attachments: Attachment[] = [];
    // Match complete attachment markers only, keeping captions and their line breaks.
    message = message.replace(/^[\u200e\u200f]?(.+?) \(file attached\)\s*$/gm, (_, filename: string) => {
      attachments.push(resolve(filename, `a-${index}-${attachments.length}`)); return '';
    });
    message = message.replace(/[\u200e\u200f]?<attached:\s*([^>]+)>/gi, (_, filename: string) => {
      attachments.push(resolve(filename, `a-${index}-${attachments.length}`)); return '';
    });
    const omitted = message.replace(directional, '').trim().match(/^<?(?:(image|video|audio|sticker|document|gif|media|contact card) omitted)>?$/i);
    if (omitted) {
      const label = omitted[1].toLowerCase();
      const kind: MediaKind = label === 'gif' ? 'image' : ['image', 'video', 'audio', 'sticker'].includes(label) ? label as MediaKind : 'document';
      attachments.push({ id: `a-${index}-omitted`, filename: `${label === 'media' ? 'Attachment' : label[0].toUpperCase() + label.slice(1)} not included`, kind, mime: '', unavailable: 'omitted' });
      message = '';
    }
    let dateStamp = dateCache.get(record.date);
    if (!dateStamp) { dateStamp = stamp(record.date, '', chosenOrder); dateCache.set(record.date, dateStamp); }
    return { id: `m-${record.line}`, sourceIndex: index, sender, text: attachments.length ? message.replace(/^\n+|\n+$/g, '') : message,
      ...dateStamp, time: record.time, rawTimestamp: `${record.date}, ${record.time}`, attachments };
  });
  if (preamble.join('\n').trim()) messages.unshift({ id: 'preamble', sourceIndex: -1, sender: null, text: preamble.join('\n').trim(), dateKey: null, dateLabel: '', time: '', rawTimestamp: '', attachments: [] });
  const missing = messages.flatMap(m => m.attachments).filter(a => a.unavailable && a.unavailable !== 'omitted').length;
  return {
    title: participants.length > 2 ? 'Group conversation' : 'Conversation', participants, messages,
    warnings: missing ? [`${missing} attachment${missing === 1 ? '' : 's'} could not be matched.`] : [],
    needsDateOrder: !dateOrder && orders.size === 0 && ambiguous,
    dateExamples: [...new Set(records.map(r => r.date))].slice(0, 3),
  };
}
