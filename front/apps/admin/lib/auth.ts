import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerSupabase } from "./supabase/server";

export async function requireAdmin() {
  await connection();
  const supabase = await createServerSupabase();
  if (!supabase) redirect("/configuration");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin, error } = await supabase.rpc("redgo_is_admin");
  if (error || !isAdmin) {
    await supabase.auth.signOut();
    redirect("/login?error=forbidden");
  }

  return {
    supabase,
    user,
    email: user.email ?? "",
    fullName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",
  };
}

export function jwtIsAdmin(appMetadata: unknown) {
  if (!appMetadata || typeof appMetadata !== "object") return false;
  return "role" in appMetadata && appMetadata.role === "admin";
}
