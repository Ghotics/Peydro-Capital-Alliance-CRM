/* A tiny page switcher based on the part of the address after "#".
     #/            -> leads list
     #/lead/<id>   -> one lead
   Using "#" means the hosting needs no special setup: every address loads index.html. */
import { useEffect, useState } from 'react';

export type Route = { name: 'list' } | { name: 'lead'; id: string };

function parse(hash: string): Route {
  const lead = hash.match(/^#\/lead\/([0-9a-f-]{36})$/i);
  if (lead) return { name: 'lead', id: lead[1] };
  return { name: 'list' };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parse(hash);
}

export function leadHref(id: string): string {
  return `#/lead/${id}`;
}

export function go(href: string): void {
  window.location.hash = href.replace(/^#/, '');
}
