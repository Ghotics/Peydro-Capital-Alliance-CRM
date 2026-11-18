/* A tiny page switcher based on the part of the address after "#".
     #/                       -> campaigns (landing page, first tab that has campaigns)
     #/campaigns/<type>       -> campaigns, one tab: business_office | giza | quick
     #/campaigns/new          -> new campaign
     #/campaigns/new/<type>   -> new campaign with the type already picked
     #/campaign/<id>          -> one campaign (QR code)
     #/pipeline               -> pipeline board
     #/leads                  -> leads list
     #/leads/new              -> new lead (typed in by hand)
     #/lead/<id>              -> one lead
     #/analytics              -> numbers
     #/team                   -> team, partners and buildings (owners)
     #/help                   -> how to use the CRM
   Using "#" means the hosting needs no special setup: every address loads index.html. */
import { useEffect, useState } from 'react';
import type { FormKind } from './types';

export type Route =
  | { name: 'campaigns'; form?: FormKind }
  | { name: 'campaign-new'; form?: FormKind }
  | { name: 'campaign'; id: string }
  | { name: 'pipeline' }
  | { name: 'leads' }
  | { name: 'lead-new' }
  | { name: 'lead'; id: string }
  | { name: 'analytics' }
  | { name: 'team' }
  | { name: 'help' };

const UUID = '([0-9a-f-]{36})';
const FORM = '(business_office|giza|quick)';

function parse(hash: string): Route {
  let m = hash.match(new RegExp(`^#/lead/${UUID}$`, 'i'));
  if (m) return { name: 'lead', id: m[1] };
  m = hash.match(new RegExp(`^#/campaign/${UUID}$`, 'i'));
  if (m) return { name: 'campaign', id: m[1] };
  if (/^#\/leads\/?$/.test(hash)) return { name: 'leads' };
  if (/^#\/leads\/new\/?$/.test(hash)) return { name: 'lead-new' };
  m = hash.match(new RegExp(`^#/campaigns/new(?:/${FORM})?/?$`));
  if (m) return { name: 'campaign-new', form: m[1] as FormKind | undefined };
  m = hash.match(new RegExp(`^#/campaigns/${FORM}/?$`));
  if (m) return { name: 'campaigns', form: m[1] as FormKind };
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
  /** One tab of the campaigns page: only the campaigns of that type. */
  campaignTab: (form: FormKind) => `#/campaigns/${form}`,
  campaignNew: '#/campaigns/new',
  /** New campaign with the type already picked (from a campaigns tab). */
  campaignNewOf: (form: FormKind) => `#/campaigns/new/${form}`,
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
