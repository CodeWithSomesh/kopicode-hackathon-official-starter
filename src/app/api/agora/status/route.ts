import { agoraConfigured, agoraMixedLanguages } from "@/lib/homelander/agora";

export const dynamic = "force-dynamic";

/** Tells the page which voice engine to use. Only booleans: never which key is set or missing. */
export function GET() {
  return Response.json({ configured: agoraConfigured(), mixedLanguages: agoraMixedLanguages() }, { headers: { "Cache-Control": "no-store" } });
}
