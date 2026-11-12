"use client";

import type { Database } from "@redgo/shared";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "../env";

export function createBrowserSupabase() {
  const env = getSupabaseBrowserEnv();
  if (!env) return null;
  return createBrowserClient<Database>(env.url, env.publishableKey);
}
