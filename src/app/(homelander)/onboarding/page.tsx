import type { Metadata } from "next";
import { OnboardingView } from "./onboarding-view";

export const metadata: Metadata = { title: "Chat with Mochi" };

/** Onboarding: Mochi chats (voice or text, any of EN/BM/中文/தமிழ்) and fills in the buyer's profile live. */
export default function OnboardingPage() {
  return <OnboardingView />;
}
