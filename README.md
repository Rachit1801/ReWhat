# Chatfold

A static WhatsApp export viewer. React, TypeScript, Vite, plain CSS, Lucide, zip.js, and TanStack Virtual. No server application or database.

## Run

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

The production `dist/` directory is a static site. The build inserts a CSP with `connect-src 'none'`. Development mode permits Vite's local development connection; validate privacy against the production preview. `_headers` supplies additional headers on hosts that support it; the CSP is also in the HTML so connection blocking does not rely on that file being supported.

## How imports work

A bundled, inline module worker reads the ZIP directory and parses text. It never uploads the File. Media entries are extracted on demand and rendered through Blob URLs. The worker is bundled inline so the first import does not need a network request after the application loads. Media inflation is serialized, and unused Blob URLs are evicted above a 64 MiB cache budget. Clearing/replacing a chat terminates its worker and revokes its URLs.

The session exists only in memory. Refreshing the page clears imported data. There are no cookies, localStorage, IndexedDB, analytics, external fonts, link previews, or backend endpoints. Clicking a message link explicitly opens the destination with no referrer.

The archive limit is 1 GiB, the transcript limit 32 MiB, the individual extracted media limit 256 MiB, and the archive entry limit 25,000. Actual decompressed byte counts are checked as well as ZIP metadata. Password-protected and corrupt archives receive errors.

Common numeric-date Android and iPhone formats are supported. Date order is inferred from unambiguous dates; otherwise the user chooses. Timestamps remain in the export's wall-clock time and transcript order is never sorted. Attachment matching prefers normalized full paths, then a unique normalized basename. Collisions are shown as unavailable rather than guessed.

## Reference verification

The supplied personal ZIP and screenshots live outside this application directory. They are never copied into the source repository, fixtures, or build. Verify the original local sample explicitly:

```sh
node scripts/verify-sample.mjs "/absolute/path/to/sample.zip"
```

Verified sample expectations: 31 dated records, 29 participant messages, two participants, three matched images, one image caption, four blank records, and original source order. The first mapped payment screenshot was also compared visually with the original WhatsApp screenshot.

WhatsApp exports lose information: native payment cards become text, some calls become blank timed records, and read/forward/reply metadata may be absent. Chatfold keeps the exported text or a neutral placeholder; it does not reconstruct missing statuses.

## Synthetic browser fixtures

```sh
node scripts/create-test-fixtures.mjs
npm run test:browser
```

The fixture generator creates only synthetic files in ignored `.local/`: iPhone media, ambiguous dates, multiple transcripts, 100,000 messages, and a corrupt ZIP. The invalid MP4 intentionally checks the unsupported-playback fallback. Unit tests also verify extraction with network APIs forbidden and Blob URL cleanup.

Browser test prerequisites: install Playwright's Chromium with `npx playwright install chromium`. The browser suite uses the production preview on port 5173; `npm run build` must run first. It checks offline import, no application network traffic after load, session clearing, safe rendering, media fallbacks, responsive overflow, and bounded DOM rendering on the large fixture.

No personal reference files should be served by a development server or added to any published source. This app's Vite root is this directory, not the parent workspace containing the reference files.

## Verification performed

- 31 unit/integration tests pass, including 100,000-message parsing, ZIP reading with network APIs disabled, safe media mapping, and Blob URL cleanup.
- The supplied local sample passes all record/media assertions. Its first image was opened in the production browser preview and compared with the reference screenshot.
- Production-preview browser checks cover participant selection, search, image enlargement, native audio playback, GIF/WebP rendering, unsupported video fallback, safe literal HTML display, ambiguous-date selection, multiple transcripts, cancellation preserving the previous chat, themes, and mobile overflow.
- A 100,000-message import rendered only 14 message elements at the latest-message position; searching for message 50,000 located it with 21 rendered elements.
- The npm dependency audit reports zero vulnerabilities.
- The standalone Playwright suite is provided for repeatable checks; it was not executed in this session. Interactive browser checks used the connected browser tooling. Offline extraction is covered by the network-disabled integration test; a full browser network-disconnection test remains in the Playwright suite.
