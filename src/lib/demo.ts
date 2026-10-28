import { parseTranscript } from './parser';
import type { ParsedChat } from './types';

export const demoPicture = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#c7dce0"/><stop offset="1" stop-color="#e9e6c5"/></linearGradient><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#81aba3"/><stop offset="1" stop-color="#34786c"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h800v520H0z"/><circle cx="610" cy="115" r="44" fill="#f9edc5"/><path d="M0 235Q220 200 430 240T800 220V520H0" fill="url(#sea)"/><path d="M0 180Q140 168 230 290L370 370 320 520H0" fill="#3f5842"/><path d="M0 230Q120 222 170 315L320 400 250 520H0" fill="#627346"/><path d="M0 340Q160 300 240 382L370 435 330 520H0" fill="#a49c65"/><path d="M65 520Q280 420 225 340Q190 300 164 300" stroke="#e7d5af" stroke-width="32" fill="none"/><path d="M440 340q70 18 150-3m-125 35q70 18 150-3m-50 40q70 18 150-3" fill="none" stroke="#c8dfcf" stroke-width="3" opacity=".55"/><path d="M88 278v-42h74v42" fill="#e5ddc2"/><path d="m78 240 47-34 47 34" fill="#a36c4a"/><path d="M116 278v-22h17v22" fill="#4b6152"/><g fill="#354e37"><path d="m36 294 18-72 18 72zM172 300l16-61 17 61zM4 351l25-92 24 92z"/></g><text x="750" y="485" text-anchor="end" fill="#f4f3d6" font-family="sans-serif" font-size="15" letter-spacing="4">OFF THE GRID</text></svg>`;
export function createDemo(): ParsedChat {
  const result = parseTranscript(`17/10/2026, 10:38 am - Messages in this demo are made up. Your real chats stay on your device.
17/10/2026, 10:40 am - Alex: A little escape this weekend? 🌿
17/10/2026, 10:41 am - You: I'm in. Somewhere with no notifications.
17/10/2026, 10:42 am - Alex: coast.jpg (file attached)
Found our spot.
17/10/2026, 10:43 am - You: Okay, that's an easy yes. ☀️
17/10/2026, 10:44 am - Alex: Coffee, the coast, and absolutely no plans.
17/10/2026, 10:45 am - You: The best kind of plans.
18/10/2026, 8:15 am - Alex: On my way! Bringing the good coffee ☕
18/10/2026, 8:16 am - You: See you in ten.
18/10/2026, 6:32 pm - You: We should do this more often.
18/10/2026, 6:34 pm - Alex: *Absolutely.* Same time next weekend?`, [{ id: 'demo-coast', path: 'coast.jpg', size: demoPicture.length }]);
  result.title = 'Alex'; return result;
}
