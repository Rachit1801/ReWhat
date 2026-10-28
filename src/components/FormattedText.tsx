import { Fragment } from 'react';
import type { ReactNode } from 'react';
function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{highlight(text.slice(index + query.length), query)}</>;
}
export function FormattedText({ text, query = '' }: { text: string; query?: string }) {
  const pieces = text.split(/(https?:\/\/[^\s<>]+|```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return <>{pieces.map((piece, index) => {
    if (/^https?:\/\//.test(piece)) {
      const url = piece.replace(/[.,;!?)]+$/, '');
      return <Fragment key={index}><a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{highlight(url, query)}</a>{piece.slice(url.length)}</Fragment>;
    }
    if (piece.startsWith('```')) return <code key={index}>{highlight(piece.slice(3, -3), query)}</code>;
    if (piece.startsWith('*') && piece.endsWith('*')) return <strong key={index}>{highlight(piece.slice(1, -1), query)}</strong>;
    if (piece.startsWith('_') && piece.endsWith('_')) return <em key={index}>{highlight(piece.slice(1, -1), query)}</em>;
    if (piece.startsWith('~') && piece.endsWith('~')) return <s key={index}>{highlight(piece.slice(1, -1), query)}</s>;
    return <Fragment key={index}>{highlight(piece, query)}</Fragment>;
  })}</>;
}
