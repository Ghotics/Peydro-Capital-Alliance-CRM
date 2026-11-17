/* The side menu. To add a section: add a line here, a route in lib/router.ts and a page in Workspace.tsx. */
import { href, type Route } from './lib/router';
import type { TeamMember } from './lib/types';

export interface NavItem {
  label: string;
  href: string;
  /** Pages that light up this menu item. */
  routes: Route['name'][];
  /** Leave out to show it to everyone. */
  ownersOnly?: boolean;
  /** Shows the "new leads" counter next to it. */
  counter?: boolean;
}

export const NAV: NavItem[] = [
  { label: 'Campañas', href: href.campaigns, routes: ['campaigns', 'campaign', 'campaign-new'] },
  { label: 'Pipeline', href: href.pipeline, routes: ['pipeline'] },
  { label: 'Leads', href: href.leads, routes: ['leads', 'lead', 'lead-new'], counter: true },
  { label: 'Analítica', href: href.analytics, routes: ['analytics'] },
  { label: 'Equipo', href: href.team, routes: ['team'], ownersOnly: true },
  { label: 'Ayuda', href: href.help, routes: ['help'] },
];

export function navFor(me: TeamMember): NavItem[] {
  return NAV.filter((item) => !item.ownersOnly || me.role === 'owner');
}
