type Cached = { url: string; blob: Blob; size: number; users: number };
export class MediaStore {
  private cache = new Map<string, Cached>();
  private inflight = new Map<string, Promise<Cached>>();
  private stopped = false;
  constructor(private load: (id: string) => Promise<Blob>) {}
  async acquire(id: string) {
    if (this.stopped) throw new Error('This chat has been closed.');
    let item = this.cache.get(id);
    if (!item) {
      let task = this.inflight.get(id);
      if (!task) {
        task = this.load(id).then(blob => {
          if (this.stopped) throw new Error('This chat has been closed.');
          const result = { url: URL.createObjectURL(blob), blob, size: blob.size, users: 0 };
          this.cache.set(id, result); return result;
        }).finally(() => this.inflight.delete(id));
        this.inflight.set(id, task);
      }
      item = await task;
    }
    item.users++;
    this.cache.delete(id); this.cache.set(id, item);
    this.trim(); return item.url;
  }
  release(id: string) { const item = this.cache.get(id); if (item) item.users = Math.max(0, item.users - 1); this.trim(); }
  getBlob(id: string) { return this.cache.get(id)?.blob; }
  private trim() {
    let size = [...this.cache.values()].reduce((sum, item) => sum + item.size, 0);
    for (const [id, item] of this.cache) {
      if (size <= 64 * 1024 ** 2) break;
      if (item.users) continue;
      URL.revokeObjectURL(item.url); this.cache.delete(id); size -= item.size;
    }
  }
  dispose() { this.stopped = true; this.cache.forEach(item => URL.revokeObjectURL(item.url)); this.cache.clear(); this.inflight.clear(); }
}
