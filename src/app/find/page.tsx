import { redirect } from "next/navigation";

// The map moved to `/` (the HomeLander landing page). Old links keep their query: ?building=&unit= and ?dev=.
export default async function FindPage({ searchParams }: PageProps<"/find">) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && v[0]) q.set(k, v[0]);
  }
  redirect(q.size ? `/?${q}` : "/");
}
