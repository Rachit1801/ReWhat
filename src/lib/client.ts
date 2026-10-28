import type { DateOrder, OpenResult, ParsedChat, WorkerReply, WorkerRequest } from './types';
import ImportWorker from '../workers/import.worker?worker&inline';
type RequestBody = WorkerRequest extends infer R ? R extends WorkerRequest ? Omit<R, 'id'> : never : never;
export class ArchiveClient {
  // Bundled worker bytes allow the very first import with networking disabled.
  private worker = new ImportWorker();
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private stopped = false;
  constructor(private onProgress: (value: number, label: string) => void) {
    this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === 'progress') { onProgress(reply.value, reply.label); return; }
      const pending = this.pending.get(reply.id);
      this.pending.delete(reply.id);
      if (reply.type === 'error') pending?.reject(new Error(reply.error)); else pending?.resolve(reply.data);
    };
    this.worker.onerror = () => { this.pending.forEach(p => p.reject(new Error('The import worker stopped. Please try importing again.'))); this.pending.clear(); };
  }
  private request<T>(body: RequestBody): Promise<T> {
    if (this.stopped) return Promise.reject(new Error('Import cancelled.'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve: value => resolve(value as T), reject });
      this.worker.postMessage({ ...body, id });
    });
  }
  open(file: File) { return this.request<OpenResult>({ type: 'open', file }); }
  parse(entryId: string, dateOrder?: DateOrder) { return this.request<ParsedChat>({ type: 'parse', entryId, dateOrder }); }
  media(entryId: string) { return this.request<Blob>({ type: 'media', entryId }); }
  dispose() {
    this.stopped = true; this.worker.terminate();
    this.pending.forEach(p => p.reject(new Error('Import cancelled.'))); this.pending.clear();
  }
}
