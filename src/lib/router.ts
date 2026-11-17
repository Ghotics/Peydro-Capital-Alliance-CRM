/* A tiny page switcher based on the part of the address after "#".
     #/                 -> campaigns (landing page)
     #/campaigns/new    -> new campaign
     #/campaign/<id>    -> one campaign (QR code)
     #/pipeline         -> pipeline board
     #/leads            -> leads list
     #/leads/new        -> new lead (typed in by hand)
     #/lead/<id>        -> one lead
     #/analytics        -> numbers
     #/team             -> team, partners and buildings (owners)
     #/help             -> how to use the CRM
   Using "#" means the hosting needs no special setup: every address loads index.html. */
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'campaigns' }
  | { name: 'campaign-new' }
  | { name: 'campaign'; id: string }
  | { name: 'pipeline' }
  | { name: 'leads' }
  | { name: 'lead-new' }
  | { name: 'lead'; id: string }
  | { name: 'analytics' }
  | { name: 'team' }
  | { name: 'help' };

const UUID = '([0-9a-f-]{36})';

function parse(hash: string): Route {
  let m = hash.match(new RegExp(`^#/lead/${UUID}$`, 'i'));
  if (m) return { name: 'lead', id: m[1] };
  m = hash.match(new RegExp(`^#/campaign/${UUID}$`, 'i'));
  if (m) return { name: 'campaign', id: m[1] };
  if (/^#\/leads\/?$/.test(hash)) return { name: 'leads' };
  if (/^#\/leads\/new\/?$/.test(hash)) return { name: 'lead-new' };
  if (/^#\/campaigns\/new\/?$/.test(hash)) return { name: 'campaign-new' };
  if (/^#\/pipeline\/?$/.test(hash)) return { name: 'pipeline' };
  if (/^#\/analytics\/?$/.test(hash)) return { name: 'analytics' };
  if (/^#\/team\/?$/.test(hash)) return { name: 'team' };
  if (/^#\/help\/?$/.test(hash)) return { name: 'help' };
  return { name: 'campaigns' };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parse(hash);
}

export const href = {
  campaigns: '#/',
  campaignNew: '#/campaigns/new',
  campaign: (id: string) => `#/campaign/${id}`,
  pipeline: '#/pipeline',
  leads: '#/leads',
  leadNew: '#/leads/new',
  lead: (id: string) => `#/lead/${id}`,
  analytics: '#/analytics',
  team: '#/team',
  help: '#/help',
};

/** Kept for older imports. */
export function leadHref(id: string): string {
  return href.lead(id);
}

export function go(target: string): void {
  window.location.hash = target.replace(/^#/, '');
}
