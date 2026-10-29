import type { Message } from './types';

export type RichContent =
  | { kind: 'omitted'; label: string; video: boolean }
  | { kind: 'poll'; title: string; options: { label: string; votes: number | null }[] }
  | { kind: 'event'; title: string; start: number | null; cancelled: boolean; description: string; going: number | null };

export function richContent(text: string): RichContent | null {
  const clean = text.replace(/[\u200e\u200f]/g, '').trim();
  if (/^<?view once (?:voice )?message omitted>?$/i.test(clean)) return { kind: 'omitted', label: 'View Once message', video: false };
  if (/^<?video note omitted>?$/i.test(clean)) return { kind: 'omitted', label: 'Video note', video: true };
  if (/^POLL:\s*/i.test(clean)) {
    const lines = clean.replace(/^POLL:\s*/i, '').split('\n');
    const firstOption = lines.findIndex(line => /^OPTION:\s*/i.test(line));
    if (firstOption > 0) {
      const options = lines.slice(firstOption).map(line => line.match(/^OPTION:\s*(.*?)(?:\s*\((\d+) votes?\))?\s*$/i));
      if (options.every(Boolean)) return { kind: 'poll', title: lines.slice(0, firstOption).join('\n').trim(), options: options.map(match => ({ label: match![1], votes: match![2] === undefined ? null : Number(match![2]) })) };
    }
  }
  if (/^EVENT:\s*/i.test(clean)) {
    const lines = clean.replace(/^EVENT:\s*/i, '').split('\n');
    const field = (name: string) => lines.find(line => line.toLowerCase().startsWith(`${name.toLowerCase()}:`))?.split(':').slice(1).join(':').trim();
    const start = field('Event Start time');
    const numeric = start && /^\d+$/.test(start) ? Number(start) : NaN;
    const milliseconds = Number.isFinite(numeric) ? numeric < 1e12 ? numeric * 1000 : numeric : NaN;
    const descriptionIndex = lines.findIndex(line => /^Event Description:/i.test(line));
    return { kind: 'event', title: lines[0].trim(), start: Number.isFinite(milliseconds) && !Number.isNaN(new Date(milliseconds).getTime()) ? milliseconds : null,
      cancelled: field('Event Cancelled')?.toLowerCase() === 'true', description: descriptionIndex < 0 ? '' : [lines[descriptionIndex].replace(/^Event Description:\s*/i, ''), ...lines.slice(descriptionIndex + 1)].join('\n').trim(),
      going: /^\d+$/.test(field('Event Going') ?? '') ? Number(field('Event Going')) : null };
  }
  return null;
}

function seconds(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?$/i);
  if (!match) return NaN;
  let hour = Number(match[1]);
  if (match[4]) hour = hour % 12 + (match[4].toLowerCase() === 'pm' ? 12 : 0);
  return hour * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

export function isGrouped(message: Message, previous?: Message) {
  if (!message.sender || previous?.sender !== message.sender || previous.dateKey !== message.dateKey) return false;
  const gap = seconds(message.time) - seconds(previous.time);
  return gap >= 0 && gap < 5 * 60;
}

export interface Contact { name: string; phones: { number: string; label: string }[]; photo?: string }
const unescapeVcard = (value: string) => value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
export function parseVcards(text: string): Contact[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  return [...unfolded.matchAll(/BEGIN:VCARD\s*\r?\n([\s\S]*?)\r?\nEND:VCARD/gi)].map(match => {
    const lines = match[1].split(/\r?\n/);
    const fields = lines.map(line => { const colon = line.indexOf(':'); return { key: line.slice(0, colon), value: line.slice(colon + 1) }; }).filter(field => field.key);
    const find = (key: string) => fields.find(field => field.key.split(';')[0].toUpperCase() === key)?.value;
    const photo = fields.find(field => /^PHOTO(?:;|$)/i.test(field.key));
    let photoUrl: string | undefined;
    if (photo && /(?:ENCODING=(?:b|BASE64))/i.test(photo.key) && /^[a-z\d+/=]+$/i.test(photo.value) && photo.value.length < 2_000_000) {
      const type = /(?:TYPE=)?(?:JPEG|JPG)/i.test(photo.key) ? 'jpeg' : /PNG/i.test(photo.key) ? 'png' : null;
      if (type) photoUrl = `data:image/${type};base64,${photo.value}`;
    }
    return { name: unescapeVcard(find('FN') || find('N')?.split(';').filter(Boolean).reverse().join(' ') || 'Unnamed contact'),
      phones: fields.filter(field => /^(?:item\d+\.)?TEL(?:;|$)/i.test(field.key)).map(field => ({ number: unescapeVcard(field.value.replace(/^tel:/i, '')), label: /HOME/i.test(field.key) ? 'Home' : /WORK/i.test(field.key) ? 'Work' : 'Mobile' })), photo: photoUrl };
  });
}
