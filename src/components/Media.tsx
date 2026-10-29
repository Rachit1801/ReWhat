import { useEffect, useRef, useState } from 'react';
import { Download, File, FileWarning, Headphones, ImageOff, LoaderCircle, Maximize2, Mic, Pause, Play, UserRound, Video } from 'lucide-react';
import type { Attachment } from '../lib/types';
import type { MediaStore } from '../lib/media-store';
import { Dialog } from './Dialog';
import { parseVcards } from '../lib/message-content';
import type { Contact } from '../lib/message-content';
export function useMedia(attachment: Attachment, store: MediaStore) {
  const [url, setUrl] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setUrl(''); setBlob(null); setError('');
    if (!attachment.entryId) return;
    const id = attachment.entryId;
    let acquired = false;
    store.acquire(id).then(value => { acquired = true; if (active) { setBlob(store.getBlob(id) ?? null); setUrl(value); } else store.release(id); }).catch(() => { if (active) setError('Could not open this file.'); });
    return () => { active = false; if (acquired) store.release(id); };
  }, [attachment.entryId, store]);
  return { url, error, blob };
}
export function Media({ attachment, store, onExpand, onImageSize }: { attachment: Attachment; store: MediaStore; onExpand: (a: Attachment) => void; onImageSize?: (width: number, height: number) => void }) {
  const { url, error, blob } = useMedia(attachment, store);
  const [unsupported, setUnsupported] = useState(false);
  const name = attachment.filename.split('/').pop()!;
  if (attachment.unavailable || error) return <div className="media-unavailable"><ImageOff size={21} /><span><strong>{attachment.unavailable === 'omitted' ? name : 'Attachment unavailable'}</strong><small>{error || (attachment.unavailable === 'ambiguous' ? 'Multiple files match this name.' : attachment.unavailable === 'omitted' ? 'Export the chat with media to include it.' : name)}</small></span></div>;
  if (!url) return <div className={`media-loading ${attachment.kind}`} role="status"><LoaderCircle className="spin" size={21} /><span>Opening attachment</span></div>;
  if (!unsupported && blob && /\.vcf$/i.test(name)) return <ContactCard url={url} blob={blob} name={name} />;
  if (unsupported || attachment.kind === 'document') return <a className="document-attachment" href={url} download={name}><span className="document-icon">{unsupported ? <FileWarning size={25} /> : <File size={25} />}</span><span><strong>{name}</strong><small>{unsupported ? 'Preview unavailable · download to open' : 'Save to your device'}</small></span><Download size={17} /></a>;
  if (attachment.kind === 'image' || attachment.kind === 'sticker') return <button className={`image-attachment ${attachment.kind}`} onClick={() => onExpand(attachment)} aria-label={`Enlarge ${name}`}><img src={url} alt={name} loading="lazy" onLoad={event => { const image = event.currentTarget; if (attachment.kind !== 'sticker' && image.naturalHeight) onImageSize?.(image.naturalWidth, image.naturalHeight); }} onError={() => setUnsupported(true)} /><span className="image-expand"><Maximize2 size={16} /></span></button>;
  if (attachment.kind === 'video') return <VideoPreview url={url} name={name} animated={attachment.animated} onPlay={() => onExpand(attachment)} onError={() => setUnsupported(true)} onSize={onImageSize} />;
  return <AudioPlayer url={url} blob={blob} name={name} onError={() => setUnsupported(true)} />;
}

function durationLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function VideoPreview({ url, name, animated, onPlay, onError, onSize }: { url: string; name: string; animated?: boolean; onPlay: () => void; onError: () => void; onSize?: (width: number, height: number) => void }) {
  const [duration, setDuration] = useState(0);
  return <div className={`video-attachment ${animated ? 'gif-attachment' : ''}`}><video src={url} preload="auto" playsInline autoPlay={animated} muted loop={animated} aria-label={animated ? `Animated GIF ${name}` : `Video preview ${name}`} onLoadedMetadata={event => { const video = event.currentTarget; setDuration(video.duration); if (video.videoHeight) onSize?.(video.videoWidth, video.videoHeight); }} onError={onError} />
    {animated ? <span className="video-duration">GIF</span> : <><button className="video-play" onClick={onPlay} aria-label={`Play video ${name}`}><Play size={30} fill="currentColor" /></button><span className="video-duration"><Video size={13} fill="currentColor" /> {durationLabel(duration)}</span></>}
  </div>;
}

function AudioPlayer({ url, blob, name, onError }: { url: string; blob: Blob | null; name: string; onError: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [playError, setPlayError] = useState('');
  const voice = /\.opus$|(?:^|[-_])PTT[-_]|^PTT-/i.test(name);
  useEffect(() => {
    if (!voice || !blob) return;
    let active = true;
    const context = new AudioContext();
    // Decode the local recording to draw its actual amplitude and recover OPUS
    // duration in browsers which report an infinite streaming duration.
    blob.arrayBuffer().then(bytes => active ? context.decodeAudioData(bytes) : Promise.reject()).then(buffer => {
      if (!active) return;
      setDuration(buffer.duration);
      const samples = buffer.getChannelData(0);
      const buckets = Array.from({ length: 48 }, (_, index) => {
        let peak = 0;
        const start = Math.floor(index * samples.length / 48);
        const end = Math.floor((index + 1) * samples.length / 48);
        for (let i = start; i < end; i += Math.max(1, Math.floor((end - start) / 1000))) peak = Math.max(peak, Math.abs(samples[i]));
        return peak;
      });
      const peak = Math.max(...buckets, .01);
      setWaveform(buckets.map(value => Math.max(3, value / peak * 30)));
    }).catch(() => { /* Playback can still work if waveform decoding is unsupported. */ }).finally(() => { void context.close().catch(() => {}); });
    return () => { active = false; void context.close().catch(() => {}); };
  }, [blob, voice]);
  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else { try { setPlayError(''); await audio.play(); } catch { setPlayError('Playback could not start. Try again or download the audio.'); } }
  }
  return <div className={`audio-attachment ${voice ? 'voice-message' : 'audio-file'}`}>
    <audio ref={audioRef} preload="metadata" src={url} onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }} onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)} onDurationChange={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setCurrent(0); }} onError={onError} />
    <span className={`audio-avatar ${voice ? 'voice-avatar' : ''}`}>{voice ? <><UserRound size={32} /><Mic className="voice-mic" size={17} fill="currentColor" /></> : <Headphones size={29} />}</span>
    <button className="audio-toggle" aria-label={`${playing ? 'Pause' : 'Play'} ${voice ? 'voice message' : name}`} onClick={() => void toggle()}>{playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button>
    <div className="audio-timeline"><div className={`audio-seek ${voice ? 'waveform-seek' : ''}`}>
      {voice && <div className="audio-waveform" aria-hidden="true">{(waveform.length ? waveform : Array(48).fill(3)).map((height, index) => <i key={index} style={{ height, background: index / 48 <= current / (duration || 1) ? 'var(--audio-progress)' : undefined }} />)}</div>}
      <input type="range" min="0" max={duration || 0} step="0.01" value={Math.min(current, duration)} aria-label={`Seek ${voice ? 'voice message' : name}`} style={{ '--progress': `${duration ? current / duration * 100 : 0}%` } as React.CSSProperties} onChange={event => { if (audioRef.current) { audioRef.current.currentTime = Number(event.target.value); setCurrent(Number(event.target.value)); } }} />
    </div><span className="audio-duration">{durationLabel(current || duration)}</span></div>
    <div className="audio-tools">{playing && <button className="audio-speed" onClick={() => { const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; setSpeed(next); if (audioRef.current) audioRef.current.playbackRate = next; }} aria-label="Change playback speed">{speed}×</button>}<a href={url} download={name} className="audio-save" aria-label={`Download ${name}`}><Download size={15} /></a></div>
    {playError && <span className="audio-error" role="alert">{playError}</span>}
  </div>;
}

function ContactAvatar({ contact }: { contact: Contact }) {
  return <span className="contact-avatar">{contact.photo ? <img src={contact.photo} alt="" /> : <UserRound size={27} />}</span>;
}
function ContactCard({ url, blob, name }: { url: string; blob: Blob; name: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    blob.text().then(text => { if (active) setContacts(parseVcards(text)); }).catch(() => {});
    return () => { active = false; };
  }, [blob]);
  if (!contacts.length) return <a className="document-attachment" href={url} download={name}><span className="document-icon"><UserRound size={25} /></span><span><strong>{name}</strong><small>Download contacts</small></span><Download size={17} /></a>;
  const label = contacts.length === 1 ? contacts[0].name : `${contacts[0].name} and ${contacts.length - 1} other contact${contacts.length === 2 ? '' : 's'}`;
  return <div className="contact-card"><button className="contact-summary" onClick={() => setOpen(true)}><span className="contact-stack">{contacts.slice(0, 2).map((contact, index) => <ContactAvatar contact={contact} key={index} />)}</span><strong>{label}</strong></button><button className="rich-card-action" onClick={() => setOpen(true)}>{contacts.length === 1 ? 'View contact' : 'View all'}</button>
    {open && <Dialog title={`${contacts.length} contact${contacts.length === 1 ? '' : 's'}`} onClose={() => setOpen(false)}><div className="contact-list">{contacts.map((contact, index) => <section className="contact-detail" key={index}><div><ContactAvatar contact={contact} /><strong>{contact.name}</strong></div>{contact.phones.map((phone, i) => <div className="contact-phone" key={i}><span>{phone.number}<small>{phone.label}</small></span></div>)}</section>)}</div><a className="secondary-button" href={url} download={name}><Download size={16} /> Save contacts</a></Dialog>}
  </div>;
}
export function Lightbox({ attachment, store, onClose }: { attachment: Attachment; store: MediaStore; onClose: () => void }) {
  const { url, error } = useMedia(attachment, store);
  const video = attachment.kind === 'video';
  return <Dialog title={video ? 'Video' : 'Photo'} onClose={onClose} wide><div className="lightbox-content">{url ? video ? <video controls autoPlay playsInline src={url} /> : <img src={url} alt={attachment.filename} /> : <span>{error || 'Opening media…'}</span>}</div><div className="lightbox-footer"><span>{attachment.filename.split('/').pop()}</span>{url && <a className="secondary-button" href={url} download={attachment.filename.split('/').pop()}><Download size={16} /> Download</a>}</div></Dialog>;
}
