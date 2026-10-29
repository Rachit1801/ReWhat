import { useState } from 'react';
import { CalendarDays, Check, CircleCheck, CircleDashed, UsersRound, Video } from 'lucide-react';
import type { RichContent } from '../lib/message-content';
import { Dialog } from './Dialog';
import { FormattedText } from './FormattedText';

export function RichMessage({ content, query }: { content: RichContent; query: string }) {
  const [details, setDetails] = useState(false);
  if (content.kind === 'omitted') return <div className="omitted-message">{content.video ? <Video size={20} /> : <span className="once-icon"><CircleDashed size={23} /><span>1</span></span>}<em>{content.label}</em><span className="omitted-time-space" /></div>;
  if (content.kind === 'poll') {
    const maximum = Math.max(1, ...content.options.map(option => option.votes ?? 0));
    return <div className="poll-card"><strong className="rich-title"><FormattedText text={content.title} query={query} /></strong><span className="poll-subtitle"><CircleCheck size={15} /> Poll results</span>
      <div className="poll-options">{content.options.map((option, index) => <div className="poll-option" key={index}><span className={`poll-choice ${option.votes ? 'has-votes' : ''}`}>{option.votes ? <Check size={17} /> : null}</span><div><div className="poll-option-label"><span><FormattedText text={option.label} query={query} /></span><span className="poll-count">{option.votes ?? '—'}</span></div><div className="poll-track"><span style={{ width: `${(option.votes ?? 0) / maximum * 100}%` }} /></div></div></div>)}</div>
      <button className="rich-card-action" onClick={() => setDetails(true)}>View votes</button>
      {details && <Dialog title={content.title} onClose={() => setDetails(false)}><div className="poll-results">{content.options.map((option, index) => <div key={index}><span>{option.label}</span><strong>{option.votes === null ? 'Vote count unavailable' : `${option.votes} vote${option.votes === 1 ? '' : 's'}`}</strong></div>)}</div><p className="dialog-description">Voter names and the poll’s selection setting are not included in this export.</p></Dialog>}
    </div>;
  }
  const start = content.start === null ? 'Start time unavailable' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(content.start);
  return <div className="event-card"><button className="event-summary" onClick={() => setDetails(true)} aria-label={`View event ${content.title}`}><span className="event-icon"><CalendarDays size={25} /></span><div><strong className="rich-title"><FormattedText text={content.title} query={query} /></strong><span>{start}</span>{content.cancelled && <span className="event-cancelled">Cancelled</span>}{content.going !== null && <span className="event-going"><UsersRound size={16} /> {content.going} going</span>}</div></button><button className="rich-card-action" onClick={() => setDetails(true)}>View event</button>
    {details && <Dialog title={content.title} onClose={() => setDetails(false)}><div className="event-details"><p><CalendarDays size={19} /> {start}</p>{content.cancelled && <p>Event cancelled</p>}{content.description && <p className="event-description"><FormattedText text={content.description} query="" /></p>}{content.going !== null && <p>{content.going} going</p>}</div></Dialog>}
  </div>;
}
