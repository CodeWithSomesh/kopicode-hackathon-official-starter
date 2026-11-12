import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Assistant"
        description="Streaming AI chat through the Vercel AI Gateway. Change the model and system prompt in src/app/api/chat/route.ts."
      />
      <Chat />
    </div>
  );
}
