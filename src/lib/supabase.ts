/* The one connection to Supabase used by the whole app. */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when the .env file is missing. The app then shows a short message instead of a blank page. */
export const missingConfig = !url || !key;

/* Links from the invite / reset-password emails arrive as  …/#access_token=…&type=invite
   (or type=recovery), and broken or expired links as  …/#error=…&error_description=…
   We read the address here, BEFORE Supabase reads the login out of it and cleans it up.
   Our own page addresses start with "#/" and are skipped. */
const hash = window.location.hash;
const linkParams = new URLSearchParams(hash.startsWith('#/') ? '' : hash.slice(1));

export const emailLink = {
  /** 'invite' or 'recovery' when the person arrived from one of those emails. */
  type: linkParams.get('type'),
  /** Supabase's message when the link didn't work (usually: expired). */
  error: linkParams.get('error_description'),
};

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: {
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
