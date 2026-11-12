import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-svh place-items-center px-4">
      <div className="grid justify-items-center gap-3 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
