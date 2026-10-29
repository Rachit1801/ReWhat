import type { CSSProperties } from 'react';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, FilePlus2, Info, LockKeyhole, MoreVertical, Moon, Sun, Search, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import type { Attachment, Message, ParsedChat } from '../lib/types';
import type { MediaStore } from '../lib/media-store';
import { FormattedText } from './FormattedText';
import { IconButton } from './Icons';
import { Lightbox, Media } from './Media';
import { isGrouped, richContent } from '../lib/message-content';
import { RichMessage } from './RichMessage';
type Row = { type: 'date'; id: string; label: string } | { type: 'message'; id: string; message: Message; grouped: boolean };
export function ChatView({ chat, me, store, filename, isDemo, onImport, onClear, onIdentity, onBack, theme, onToggleTheme }: { chat: ParsedChat; me: string; store: MediaStore; filename: string; isDemo: boolean; onImport: () => void; onClear: () => void; onIdentity: () => void; onBack: () => void; theme: 'dark' | 'light'; onToggleTheme: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchQuery = useDeferredValue(query.trim());
  const [matchIndex, setMatchIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Attachment | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [info, setInfo] = useState(false);
  const [mediaWidths, setMediaWidths] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => {
    const result: Row[] = [];
    let date: string | null = null;
    chat.messages.forEach((message, index) => {
      if (message.dateKey && message.dateKey !== date) { result.push({ type: 'date', id: `date-${message.id}`, label: message.dateLabel }); date = message.dateKey; }
      const previous = chat.messages[index - 1];
      result.push({ type: 'message', id: message.id, message, grouped: isGrouped(message, previous) });
    }); return result;
  }, [chat]);
  const matches = useMemo(() => !searchQuery ? [] : rows.flatMap((row, index) => row.type === 'message' && `${row.message.text} ${row.message.attachments.map(a => a.filename).join(' ')}`.toLocaleLowerCase().includes(searchQuery.toLocaleLowerCase()) ? [index] : []), [rows, searchQuery]);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: index => rows[index].type === 'date' ? 46 : rows[index].message.attachments.length ? 320 : 54, overscan: 8, getItemKey: index => rows[index].id });
  useLayoutEffect(() => { const frame = requestAnimationFrame(() => virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })); return () => cancelAnimationFrame(frame); }, [chat, rows.length, virtualizer]);
  useEffect(() => { setMatchIndex(0); if (matches.length) virtualizer.scrollToIndex(matches[0], { align: 'center' }); }, [matches, virtualizer]);
  useLayoutEffect(() => {
    if (!matches.length) return;
    const frame = requestAnimationFrame(() => virtualizer.scrollToIndex(matches[matchIndex] ?? matches[0], { align: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [mediaWidths, matches, matchIndex, virtualizer]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);
  const navigate = (step: number) => { if (!matches.length) return; const next = (matchIndex + step + matches.length) % matches.length; setMatchIndex(next); virtualizer.scrollToIndex(matches[next], { align: 'center' }); };
  const group = chat.participants.length > 2;
  const title = group || chat.title !== 'Conversation' ? chat.title : chat.participants.find(p => p !== me) ?? chat.participants[0] ?? 'Conversation';
  const initials = title.replace(/^\+/, '').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  return <main className="chat-page">
    <section className="chat-shell">
      <header className="chat-header"><IconButton label="Back to home" onClick={onBack}><ArrowLeft size={20} /></IconButton><div className="avatar chat-avatar">{initials || <UserRound size={20} />}</div><div className="chat-title"><h1>{title}</h1><span>{group ? `${chat.participants.length} participants · ` : ''}{chat.messages.filter(m => m.sender).length.toLocaleString()} messages </span></div><div className="chat-header-actions"><IconButton label="Search conversation" onClick={() => setSearchOpen(!searchOpen)} aria-expanded={searchOpen}><Search size={20} /></IconButton><IconButton label="Import another chat" onClick={onImport}><FilePlus2 size={20} /></IconButton><div className="menu-wrap" ref={menuRef}><IconButton label="Chat options" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}><MoreVertical size={20} /></IconButton>{menuOpen && <div className="chat-menu"><button onClick={() => { setMenuOpen(false); onToggleTheme(); }}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}</button><button onClick={() => { setMenuOpen(false); onIdentity(); }}><UserRound size={16} /> Choose your name</button><button onClick={() => { setMenuOpen(false); setInfo(!info); }}><Info size={16} /> About this import</button><button className="danger" onClick={onClear}><Trash2 size={16} /> Clear this chat</button></div>}</div></div></header>
      {info && <div className="chat-info"><Info size={16} /><div><strong>{filename}</strong><span>{chat.warnings.length ? chat.warnings.join(' ') : 'All available attachments matched.'} Exports may leave out call details, payment cards, and read receipts.</span></div><IconButton label="Close import details" onClick={() => setInfo(false)}><X size={16} /></IconButton></div>}
      {searchOpen && <div className="search-bar"><Search size={17} /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search this conversation" aria-label="Search messages" onKeyDown={event => { if (event.key === 'Enter') navigate(event.shiftKey ? -1 : 1); if (event.key === 'Escape') { setSearchOpen(false); setQuery(''); } }} /><span className="search-count" aria-live="polite">{searchQuery ? matches.length ? `${matchIndex + 1} of ${matches.length}` : 'No results' : ''}</span><IconButton label="Previous result" onClick={() => navigate(-1)} disabled={!matches.length}><ChevronLeft size={18} /></IconButton><IconButton label="Next result" onClick={() => navigate(1)} disabled={!matches.length}><ChevronRight size={18} /></IconButton><IconButton label="Close search" onClick={() => { setSearchOpen(false); setQuery(''); }}><X size={18} /></IconButton></div>}
      <div className="conversation-area chat-wallpaper"><div className="conversation-scroll" ref={scrollRef} role="log" aria-label="Imported conversation" aria-live="off" tabIndex={0} onScroll={() => { const el = scrollRef.current!; setAtBottom(el.scrollHeight - el.clientHeight - el.scrollTop < 180); }}>
        <div className="conversation-inner" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map(item => {
            const row = rows[item.index];
            const content = row.type === 'message' ? richContent(row.message.text) : null;
            return <div className="virtual-row" key={item.key} data-index={item.index} ref={virtualizer.measureElement} style={{ transform: `translateY(${item.start}px)` }}>
              {row.type === 'date' ? <div className="date-separator"><span>{row.label}</span></div> : row.message.sender === null ? <div className="system-row"><div>{row.message.text || 'Details unavailable in export'}{row.message.time && <time>{row.message.time}</time>}</div></div> : <div className={`message-row ${row.message.sender === me ? 'outgoing' : 'incoming'} ${row.grouped ? 'grouped' : ''} ${matches[matchIndex] === item.index ? 'active-match' : ''}`} data-message-id={row.message.id}>
                <article style={{ '--media-width': `${mediaWidths[row.message.id] ?? 310}px` } as CSSProperties} className={`message-bubble ${row.message.attachments.some(a => a.kind === 'image' || a.kind === 'video') ? 'media-bubble' : ''} ${row.message.attachments.some(a => a.kind === 'sticker') && !row.message.text ? 'sticker-bubble' : ''}`} aria-label={`${row.message.sender}, ${row.message.dateLabel}, ${row.message.time}`}>
                  {group && row.message.sender !== me && !row.grouped && <div className={`sender-name sender-${chat.participants.indexOf(row.message.sender) % 5}`}>{row.message.sender}</div>}
                  {row.message.attachments.map(attachment => <Media key={attachment.id} attachment={attachment} store={store} onExpand={setExpanded} onImageSize={(width, height) => { const next = Math.round(Math.min(340, width * 420 / height)) + 10; setMediaWidths(previous => previous[row.message.id] === next ? previous : { ...previous, [row.message.id]: next }); }} />)}
                  {content ? <RichMessage key={row.message.id} content={content} query={searchQuery} /> : row.message.text ? <div className="message-text"><FormattedText text={row.message.text} query={searchQuery} /><span className="message-time-space" aria-hidden="true">{row.message.time}</span></div> : !row.message.attachments.length ? <div className="empty-message"><Info size={13} /> Details unavailable in export<span className="message-time-space" aria-hidden="true">{row.message.time}</span></div> : null}
                  <time className="message-time" title={row.message.rawTimestamp}>{row.message.time}</time>
                </article>
              </div>}
            </div>;
          })}
        </div>
      </div>{!atBottom && <button className="jump-latest" onClick={() => virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })} aria-label="Jump to latest message"><ChevronDown size={22} /></button>}</div>
    </section>
    {expanded && <Lightbox attachment={expanded} store={store} onClose={() => setExpanded(null)} />}
  </main>;
}
