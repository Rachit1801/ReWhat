import { ChatArchive } from '../lib/archive';
import { parseTranscript } from '../lib/parser';
import type { WorkerReply, WorkerRequest } from '../lib/types';

let archive = new ChatArchive();
let mediaQueue = Promise.resolve();
const send = (message: WorkerReply) => self.postMessage(message);
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    let data;
    if (request.type === 'open') {
      await archive.close(); archive = new ChatArchive();
      send({ id: request.id, type: 'progress', value: 10, label: 'Opening your ZIP' });
      data = await archive.open(request.file, (value, label) => send({ id: request.id, type: 'progress', value, label }));
    } else if (request.type === 'parse') {
      send({ id: request.id, type: 'progress', value: 65, label: 'Putting your chat together' });
      data = parseTranscript(await archive.readText(request.entryId), archive.entries, request.dateOrder);
    } else {
      // Bound concurrent inflation even when many attachments enter the viewport.
      const operation = mediaQueue.then(() => archive.readMedia(request.entryId));
      mediaQueue = operation.then(() => {}, () => {});
      data = await operation;
    }
    send({ id: request.id, type: 'success', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read this export. Please try another ZIP.';
    const readable = request.type === 'open' && !/^(?:This ZIP|No WhatsApp|Password-protected|This file)/.test(message)
      ? 'This ZIP could not be read. It may be incomplete or damaged. Try exporting the chat again.' : message;
    send({ id: request.id, type: 'error', error: readable });
  }
};
