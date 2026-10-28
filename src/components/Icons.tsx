import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark"><MessageSquare size={22} strokeWidth={2.2} /></span><span>chatfold<span className="brand-period">.</span></span></span>;
}
export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button type="button" className="icon-button" title={label} aria-label={label} {...props}>{children}</button>;
}
