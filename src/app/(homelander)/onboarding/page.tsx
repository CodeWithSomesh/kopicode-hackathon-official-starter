import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { OnboardingView } from "./onboarding-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Chat with Mochi") };
}

/** Onboarding: Mochi chats (voice or text, any of EN/BM/中文/தமிழ்) and fills in the buyer's profile live. */
export default function OnboardingPage() {
  return <OnboardingView />;
}
