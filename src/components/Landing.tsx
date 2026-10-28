import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCheck, FileArchive, Image, LockKeyhole, MessageCircle, MonitorSmartphone, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { demoPicture } from '../lib/demo';
export function Landing({ onFile, onDemo, onPick, onHelp, error }: { onFile: (file: File) => void; onDemo: () => void; onPick: () => void; onHelp: () => void; error: string }) {
  const [dragging, setDragging] = useState(false);
  return <main className="landing">
    <section className="hero">
      <div className="hero-copy">
        <h1>Some chats are worth<br /><span>coming back to.</span><svg className="hero-underline" viewBox="0 0 410 16" aria-hidden="true"><path d="M3 10Q182-3 405 8M42 14Q225 3 370 11" /></svg></h1>
        <p className="hero-description">Your WhatsApp conversations, together again.</p>
        <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) onFile(file); }}>
          <div className="dropzone-icon"><FileArchive size={26} strokeWidth={1.5} /><span className="upload-mini"><ArrowUpRight size={12} /></span></div>
          <div className="dropzone-copy"><strong>Drop your chat ZIP here</strong><span>With media or without. We’ll put it together.</span></div>
          <button className="primary-button" onClick={onPick}><Upload size={17} /> Open a chat <ArrowRight size={17} /></button>
          <div className="dropzone-foot"><LockKeyhole size={12} /><span>Your files never leave this device.</span></div>
        </div>
        {error && <div className="import-error" role="alert">{error}</div>}
        <div className="hero-actions"><button className="text-button" onClick={onDemo}>Just looking? Try a demo <ArrowUpRight size={15} /></button><span className="action-divider" /><button className="muted-button" onClick={onHelp}>How to export a chat <ArrowUpRight size={14} /></button></div>
      </div>
      <div className="hero-visual" aria-label="Preview of a reconstructed conversation">
        <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
        <div className="floating-label label-top"><span className="small-icon"><MessageCircle size={17} /></span><span>Just like you remember.</span><Sparkles size={15} /></div>
        <div className="preview-window">
          <div className="window-top"><div className="window-dots"><i /><i /><i /></div><span><LockKeyhole size={10} /> ONLY ON YOUR DEVICE</span><span className="window-dot" /></div>
          <div className="preview-header"><div className="avatar preview-avatar">A<span /></div><div><strong>Alex</strong><span>A conversation worth keeping</span></div><ShieldCheck size={19} /></div>
          <div className="preview-messages chat-wallpaper">
            <span className="preview-date">17 October 2026</span>
            <div className="preview-bubble received">A little escape this weekend? 🌿<span className="preview-time">10:40</span></div>
            <div className="preview-bubble sent">I'm in. Somewhere with<br />no notifications.<span className="preview-time">10:41 <CheckCheck size={13} /></span></div>
            <div className="preview-bubble received preview-photo"><img src={`data:image/svg+xml,${encodeURIComponent(demoPicture)}`} alt="An illustrated coastal escape" /><div>Found our spot.<span className="preview-time">10:42</span></div></div>
            <div className="preview-bubble sent">Okay, that's an easy yes. ☀️<span className="preview-time">10:43 <CheckCheck size={13} /></span></div>
          </div>
          <div className="preview-footer"><LockKeyhole size={12} /><span>A little nostalgia. A lot of privacy.</span><Check size={14} /></div>
        </div>
        <div className="floating-label label-bottom"><span className="photo-stack"><Image size={18} /></span><div><strong>Everything, together.</strong><span>Photos, voice notes & the little things.</span></div><span className="label-check"><Check size={13} /></span></div>
        <div className="visual-note"><svg viewBox="0 0 58 50" aria-hidden="true"><path d="M48 3q-4 32-36 28m0 0 10-10m-10 10 13 7" /></svg><span>Same conversation.<br />A fresh way to revisit it.</span></div>
      </div>
    </section>
  </main>;
}
