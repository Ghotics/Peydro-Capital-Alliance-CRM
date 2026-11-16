/* Shapes of the rows the app reads. They follow the tables in Supabase. */

export type Stage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'meeting_booked'
  | 'proposal_sent'
  | 'won'
  | 'not_ready'
  | 'lost';

export type FormKind = 'giza' | 'business_office' | 'quick';

export interface TeamMember {
  id: string;
  name: string;
  role: 'owner' | 'specialist';
  /** Departments this person works in: giza, quick, tecnologia, marketing, … */
  areas: string[];
  active: boolean;
  cal_link: string | null;
}

/** One line of the leads list. */
export interface LeadRow {
  id: string;
  created_at: string;
  stage: Stage;
  form: FormKind;
  area: string | null;
  /** Filled in by the database: area for Business Office leads, otherwise the form. */
  department: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  owner_id: string | null;
  campaign: { code: string; name: string } | null;
}

/** A full lead, for the lead page. */
export interface Lead extends Omit<LeadRow, 'campaign'> {
  updated_at: string;
  interests: string[];
  unit: string | null;
  message: string | null;
  utm: Record<string, string> | null;
  page: string | null;
  privacy_accepted_at: string | null;
  meeting_at: string | null;
  lost_reason: string | null;
  deal_value_eur: number | null;
  campaign: { code: string; name: string; form: FormKind } | null;
  building: { name: string; partner: { name: string } | null } | null;
}

export interface Building {
  id: string;
  name: string;
  partner: { name: string } | null;
}

export interface Campaign {
  id: string;
  code: string;
  form: FormKind;
  name: string;
  active: boolean;
  created_at: string;
  building_id: string | null;
  building: Building | null;
}

export interface Note {
  id: string;
  lead_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
