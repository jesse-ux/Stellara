import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { count } = await supabase
    .from("voices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  redirect(count ? "/generate" : "/onboarding");
}
