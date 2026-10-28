export type DateOrder = 'dmy' | 'mdy';
export type MediaKind = 'image' | 'video' | 'audio' | 'sticker' | 'document';
export interface ArchiveEntry { id: string; path: string; size: number }
export interface Attachment {
  id: string; filename: string; kind: MediaKind; mime: string;
  entryId?: string; unavailable?: 'missing' | 'ambiguous' | 'omitted';
}
export interface Message {
  id: string; sourceIndex: number; sender: string | null; text: string;
  dateKey: string | null; dateLabel: string; time: string; rawTimestamp: string;
  attachments: Attachment[];
}
export interface ParsedChat {
  title: string; participants: string[]; messages: Message[]; warnings: string[];
  needsDateOrder: boolean; dateExamples: string[];
}
export interface OpenResult { transcripts: ArchiveEntry[]; fileCount: number }
export type WorkerRequest =
  | { id: number; type: 'open'; file: File }
  | { id: number; type: 'parse'; entryId: string; dateOrder?: DateOrder }
  | { id: number; type: 'media'; entryId: string };
export type WorkerReply = { id: number } & (
  | { type: 'success'; data: OpenResult | ParsedChat | Blob }
  | { type: 'error'; error: string }
  | { type: 'progress'; value: number; label: string }
);
