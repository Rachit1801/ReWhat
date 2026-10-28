import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, FileText, HelpCircle, LoaderCircle, LockKeyhole, Moon, ShieldCheck, Sun, UserRound, X } from 'lucide-react';
import { ArchiveClient } from './lib/client';
import { MediaStore } from './lib/media-store';
import { createDemo, demoPicture } from './lib/demo';
import type { ArchiveEntry, DateOrder, ParsedChat } from './lib/types';
import { Brand, IconButton } from './components/Icons';
import { Dialog } from './components/Dialog';
import { Landing } from './components/Landing';
import { ChatView } from './components/ChatView';

interface Session { id: number; chat: ParsedChat; me: string; filename: string; store: MediaStore; demo: boolean }
type Pending = { kind: 'transcript'; entries: ArchiveEntry[] } | { kind: 'date'; chat: ParsedChat } | { kind: 'identity'; chat: ParsedChat; existing: boolean } | null;
export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [help, setHelp] = useState<'export' | 'privacy' | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ value: 0, label: 'Opening your ZIP' });
  const [error, setError] = useState('');
  const [showLanding, setShowLanding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const candidate = useRef<ArchiveClient | null>(null);
  const active = useRef<ArchiveClient | null>(null);
  const sourceName = useRef('');
  const transcript = useRef<ArchiveEntry | null>(null);
  const generation = useRef(0);
  const sessionId = useRef(0);
  const sessionRef = useRef(session); sessionRef.current = session;
  useEffect(() => { document.documentElement.dataset.theme = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111713' : '#f8f9f5'); }, [theme]);
  useEffect(() => () => { active.current?.dispose(); candidate.current?.dispose(); sessionRef.current?.store.dispose(); }, []);
  function cancel() { generation.current++; candidate.current?.dispose(); candidate.current = null; setPending(null); setBusy(false); }
  function clear() { cancel(); active.current?.dispose(); active.current = null; sessionRef.current?.store.dispose(); setSession(null); setShowLanding(false); setError(''); }
  async function parse(entry: ArchiveEntry, dateOrder?: DateOrder) {
    const client = candidate.current; const version = generation.current;
    if (!client) return;
    transcript.current = entry; setPending(null); setBusy(true);
    try {
      const chat = await client.parse(entry.id, dateOrder);
      if (version !== generation.current) return;
      const inferredTitle = entry.path.split('/').pop()!.replace(/\.txt$/i, '').replace(/^WhatsApp Chat (?:with|[-–])\s*/i, '');
      if (!/^_?chat$/i.test(inferredTitle)) chat.title = inferredTitle;
      setBusy(false);
      if (chat.needsDateOrder) setPending({ kind: 'date', chat });
      else if (chat.participants.length) setPending({ kind: 'identity', chat, existing: false });
      else finish(chat, '');
    } catch (e) { if (version === generation.current) { cancel(); setError(e instanceof Error ? e.message : 'Unable to open this chat.'); } }
  }
  async function importFile(file: File) {
    if (!/\.zip$/i.test(file.name)) { setError('Choose a WhatsApp export ZIP file.'); return; }
    cancel(); setError(''); setBusy(true); setProgress({ value: 0, label: 'Opening your ZIP' }); sourceName.current = file.name;
    const version = generation.current;
    const client = new ArchiveClient((value, label) => { if (version === generation.current) setProgress({ value, label }); });
    candidate.current = client;
    try {
      const result = await client.open(file);
      if (version !== generation.current) return;
      if (result.transcripts.length > 1) { setBusy(false); setPending({ kind: 'transcript', entries: result.transcripts }); }
      else await parse(result.transcripts[0]);
    } catch (e) { if (version === generation.current) { cancel(); setError(e instanceof Error ? e.message : 'Unable to open this ZIP.'); } }
  }
  function finish(chat: ParsedChat, me: string) {
    if (pending?.kind === 'identity' && pending.existing && session) { setSession({ ...session, me }); setPending(null); return; }
    const client = candidate.current; if (!client) return;
    active.current?.dispose(); sessionRef.current?.store.dispose(); active.current = client; candidate.current = null;
    setSession({ id: ++sessionId.current, chat, me, filename: sourceName.current, store: new MediaStore(id => client.media(id)), demo: false });
    setPending(null); setBusy(false); setShowLanding(false);
  }
  function demo() {
    clear();
    setSession({ id: ++sessionId.current, chat: createDemo(), me: 'You', filename: 'Demo conversation', demo: true, store: new MediaStore(async () => new Blob([demoPicture], { type: 'image/svg+xml' })) });
    setShowLanding(false);
  }
  const pick = () => inputRef.current?.click();
  const closePending = () => { if (pending?.kind === 'identity' && pending.existing) setPending(null); else cancel(); };
  return <div className="app">
    <header className="app-header"><button className="brand-button" onClick={() => setShowLanding(true)} aria-label="Chatfold home"><Brand /></button><nav><button className="nav-help" onClick={() => setHelp('export')}>How it works <HelpCircle size={14} /></button><button className="privacy-pill" onClick={() => setHelp('privacy')}><span className="status-dot" /><LockKeyhole size={12} /><span>100% on your device</span></button><span className="nav-divider" /><IconButton label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</IconButton></nav></header>
    <input ref={inputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="visually-hidden" aria-label="Choose WhatsApp ZIP" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} />
    {session && !showLanding ? <><ChatView key={session.id} chat={session.chat} me={session.me} store={session.store} filename={session.filename} isDemo={session.demo} onImport={pick} onClear={clear} onIdentity={() => setPending({ kind: 'identity', chat: session.chat, existing: true })} onBack={() => setShowLanding(true)} />{error && <div className="error-toast" role="alert">{error}<IconButton label="Dismiss error" onClick={() => setError('')}><X size={16} /></IconButton></div>}</> : <><Landing onFile={file => void importFile(file)} onDemo={demo} onPick={pick} onHelp={() => setHelp('export')} error={error} />{session && <button className="return-chat secondary-button" onClick={() => setShowLanding(false)}>Return to your chat <ArrowRight size={16} /></button>}</>}
    <footer className="app-footer"><span><Brand compact /> <span className="footer-tagline">A little closer to your conversations.</span></span><span><LockKeyhole size={12} /> Local by design.</span></footer>
    {busy && <Dialog title="A moment for your memories" onClose={cancel}><div className="import-progress"><span className="progress-icon"><LoaderCircle className="spin" size={30} /></span><p>{progress.label}</p><progress max={100} value={progress.value} /><span>Everything happens on this device.</span><button className="secondary-button" onClick={cancel}>Cancel import</button></div></Dialog>}
    {pending?.kind === 'transcript' && <Dialog title="Choose a conversation" onClose={closePending}><p className="dialog-description">This ZIP contains more than one chat.</p><div className="choice-list">{pending.entries.map(entry => <button key={entry.id} onClick={() => void parse(entry)}><FileText size={20} /><span>{entry.path.split('/').pop()}</span><ChevronRight size={18} /></button>)}</div></Dialog>}
    {pending?.kind === 'date' && <Dialog title="One small date check" onClose={closePending}><p className="dialog-description">How are dates written in this export?<br /><span className="date-example">{pending.chat.dateExamples.join(' · ')}</span></p><div className="choice-list"><button onClick={() => void parse(transcript.current!, 'dmy')}><span><strong>Day / Month / Year</strong><small>e.g. 03/04 = 3 April</small></span><ChevronRight size={18} /></button><button onClick={() => void parse(transcript.current!, 'mdy')}><span><strong>Month / Day / Year</strong><small>e.g. 03/04 = March 4</small></span><ChevronRight size={18} /></button></div></Dialog>}
    {pending?.kind === 'identity' && <Dialog title="Which one is you?" onClose={closePending}><p className="dialog-description">Your messages will appear on the right.</p><div className="choice-list">{pending.chat.participants.map(person => <button key={person} onClick={() => finish(pending.chat, person)}><span className="choice-avatar"><UserRound size={18} /></span><span>{person}</span>{session?.me === person ? <Check size={18} /> : <ChevronRight size={18} />}</button>)}</div><button className="browse-button" onClick={() => finish(pending.chat, '')}>Just browsing — keep everyone on the left</button></Dialog>}
    {help && <Dialog title={help === 'privacy' ? 'Your chats stay yours.' : 'From WhatsApp to Chatfold.'} onClose={() => setHelp(null)}>{help === 'privacy' ? <div className="privacy-content"><span className="privacy-illustration"><ShieldCheck size={38} strokeWidth={1.5} /></span><p>Your ZIP is opened in your browser. Messages and media are never uploaded.</p><div><Check size={16} /> No accounts, analytics, or cloud storage.</div><div><Check size={16} /> Refresh or close this page to clear the chat.</div><div><Check size={16} /> Media loads only from your imported file.</div></div> : <><p className="dialog-description">Three little steps. Your whole conversation.</p><ol className="help-steps"><li><span>1</span><div><strong>Open a chat in WhatsApp</strong><p>Tap the contact or group name, then Export chat. On Android: ⋮ → More → Export chat.</p></div></li><li><span>2</span><div><strong>Choose “Include media”</strong><p>For photos, videos, and voice notes. Text-only exports work too.</p></div></li><li><span>3</span><div><strong>Save the ZIP, then open it here</strong><p>Select your name. We’ll handle the rest.</p></div></li></ol><button className="primary-button full-width" onClick={() => { setHelp(null); pick(); }}>Open a chat <ArrowRight size={16} /></button></>}</Dialog>}
  </div>;
}
