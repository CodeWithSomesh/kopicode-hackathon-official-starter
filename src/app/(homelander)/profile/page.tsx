import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { ProfileView } from "./profile-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Profile") };
}

/** The buyer's saved answers from Uncle, their bank estimate and shortlist. Moves to Supabase with login. */
export default function ProfilePage() {
  return <ProfileView />;
}
