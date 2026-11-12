import { agoraConfigured } from "@/lib/homelander/agora";

export const dynamic = "force-dynamic";

/** Tells the page which voice engine to use. Only a boolean: never which key is set or missing. */
export function GET() {
  return Response.json({ configured: agoraConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
