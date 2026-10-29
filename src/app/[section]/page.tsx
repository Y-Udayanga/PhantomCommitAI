import { notFound, redirect } from "next/navigation";
import { authenticated, configured } from "@/lib/server/supabase";
import Workspace from "@/components/workspace";
const sections = [
  "dashboard",
  "repositories",
  "graveyard",
  "replay",
  "haunted-bugs",
  "detective",
  "resurrection",
  "reports",
  "settings",
  "intelligence",
  "recovery",
  "impact",
  "security",
  "timeline",
];
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "demo") redirect("/repositories");
  if (!sections.includes(section)) notFound();
  if (configured()) {
    try {
      await authenticated();
    } catch {
      redirect("/auth");
    }
  }
  return <Workspace section={section} configured={configured()} />;
}
