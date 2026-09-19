import { NextResponse } from "next/server";
import { getAllowedMember, safeNextPath } from "@/lib/access-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user && getAllowedMember(data.user.email)) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    if (data.session) await supabase.auth.signOut({ scope: "local" });
    if (!error) return NextResponse.redirect(new URL("/login?error=not-allowed", url.origin));
  }

  return NextResponse.redirect(new URL("/login?error=expired", url.origin));
}
