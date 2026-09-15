import { redirect } from "next/navigation";
import { MapJournal } from "@/components/map-journal";
import { getDashboardData } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  let userId: string | undefined;
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/login");
    userId = data.user.id;
  }
  return <MapJournal initialData={await getDashboardData(userId)} />;
}
