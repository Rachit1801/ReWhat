// Explicitly invoked against a local reference. No sample is copied into source/build.
import { readFile } from 'node:fs/promises';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js/index-native.js';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source = await readFile(new URL('../src/lib/parser.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { parseTranscript } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const path = process.argv[2];
if (!path) throw new Error('Pass the absolute path of the local sample ZIP.');
const reader = new ZipReader(new BlobReader(new Blob([await readFile(path)])), { useWebWorkers: false });
try {
  const entries = await reader.getEntries();
  const transcript = entries.find(e => /\.txt$/i.test(e.filename));
  const text = await transcript.getData(new TextWriter());
  const chat = parseTranscript(text, entries.filter(e => !e.directory).map((e, i) => ({ id: String(i), path: e.filename, size: e.uncompressedSize })));
  assert.equal(chat.messages.length, 31);
  assert.equal(chat.participants.length, 2);
  assert.equal(chat.messages.filter(m => m.sender).length, 29);
  const attachments = chat.messages.flatMap(m => m.attachments);
  assert.equal(attachments.length, 3);
  assert(attachments.every(a => a.entryId && !a.unavailable));
  assert.equal(chat.messages.filter(m => m.attachments.length && m.text).length, 1);
  assert.equal(chat.messages.filter(m => !m.text && !m.attachments.length).length, 4);
  assert.equal(chat.messages[0].dateKey, '2026-03-15');
  assert.equal(chat.messages.at(-1).dateKey, '2026-10-08');
  assert(chat.messages.every((m, i) => m.sourceIndex === i));
  console.log('Local reference passed: 31 records, 29 participant messages, 2 participants, 3 matched images, 1 caption, 4 blank records, original order.');
} finally { await reader.close(); }
