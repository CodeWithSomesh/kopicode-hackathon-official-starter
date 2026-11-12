import type { Metadata } from "next";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "Profile" };

/** The buyer's saved answers from Uncle, their bank estimate and shortlist. Moves to Supabase with login. */
export default function ProfilePage() {
  return <ProfileView />;
}
