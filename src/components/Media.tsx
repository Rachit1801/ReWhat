import { useEffect, useState } from 'react';
import { Download, File, FileWarning, ImageOff, LoaderCircle, Maximize2, Music2 } from 'lucide-react';
import type { Attachment } from '../lib/types';
import type { MediaStore } from '../lib/media-store';
import { Dialog } from './Dialog';
export function useMedia(attachment: Attachment, store: MediaStore) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setUrl(''); setError('');
    if (!attachment.entryId) return;
    const id = attachment.entryId;
    let acquired = false;
    store.acquire(id).then(value => { acquired = true; if (active) setUrl(value); else store.release(id); }).catch(() => { if (active) setError('Could not open this file.'); });
    return () => { active = false; if (acquired) store.release(id); };
  }, [attachment.entryId, store]);
  return { url, error };
}
export function Media({ attachment, store, onExpand }: { attachment: Attachment; store: MediaStore; onExpand: (a: Attachment) => void }) {
  const { url, error } = useMedia(attachment, store);
  const [unsupported, setUnsupported] = useState(false);
  const name = attachment.filename.split('/').pop()!;
  if (attachment.unavailable || error) return <div className="media-unavailable"><ImageOff size={21} /><span><strong>{attachment.unavailable === 'omitted' ? name : 'Attachment unavailable'}</strong><small>{error || (attachment.unavailable === 'ambiguous' ? 'Multiple files match this name.' : attachment.unavailable === 'omitted' ? 'Export the chat with media to include it.' : name)}</small></span></div>;
  if (!url) return <div className={`media-loading ${attachment.kind}`} role="status"><LoaderCircle className="spin" size={21} /><span>Opening attachment</span></div>;
  if (unsupported || attachment.kind === 'document') return <a className="document-attachment" href={url} download={name}><span className="document-icon">{unsupported ? <FileWarning size={25} /> : <File size={25} />}</span><span><strong>{name}</strong><small>{unsupported ? 'Preview unavailable · download to open' : 'Save to your device'}</small></span><Download size={17} /></a>;
  if (attachment.kind === 'image' || attachment.kind === 'sticker') return <button className={`image-attachment ${attachment.kind}`} onClick={() => onExpand(attachment)} aria-label={`Enlarge ${name}`}><img src={url} alt={name} loading="lazy" onError={() => setUnsupported(true)} /><span className="image-expand"><Maximize2 size={16} /></span></button>;
  if (attachment.kind === 'video') return <div className="video-attachment"><video controls preload="metadata" playsInline src={url} onError={() => setUnsupported(true)} /><a href={url} download={name} className="media-download" aria-label={`Download ${name}`}><Download size={15} /></a></div>;
  return <div className="audio-attachment"><span className="audio-title"><Music2 size={16} />{/(?:PTT-|AUDIO-)/i.test(name) ? 'Voice message' : name}</span><audio controls preload="metadata" src={url} onError={() => setUnsupported(true)} /><a className="audio-download" href={url} download={name}>Download <Download size={12} /></a></div>;
}
export function Lightbox({ attachment, store, onClose }: { attachment: Attachment; store: MediaStore; onClose: () => void }) {
  const { url, error } = useMedia(attachment, store);
  return <Dialog title="Photo" onClose={onClose} wide><div className="lightbox-content">{url ? <img src={url} alt={attachment.filename} /> : <span>{error || 'Opening photo…'}</span>}</div><div className="lightbox-footer"><span>{attachment.filename.split('/').pop()}</span>{url && <a className="secondary-button" href={url} download={attachment.filename.split('/').pop()}><Download size={16} /> Download</a>}</div></Dialog>;
}
