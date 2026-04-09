import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type GlobalWithSupabase = typeof globalThis & {
  __supabaseClient?: SupabaseClient;
};

const globalWithSupabase = globalThis as GlobalWithSupabase;

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
      "Please set these in your .env file."
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function initSupabase(): SupabaseClient {
  if (!globalWithSupabase.__supabaseClient) {
    globalWithSupabase.__supabaseClient = createSupabaseClient();
  }

  return globalWithSupabase.__supabaseClient;
}

export function getSupabase(): SupabaseClient {
  return initSupabase();
}