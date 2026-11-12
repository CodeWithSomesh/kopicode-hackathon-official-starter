import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

/**
 * Public landing page. Structure follows the demo story from the game plan:
 * problem -> how it works -> outcome. Replace the copy once the problem
 * statement is final; keep the structure.
 */
const steps = [
  { title: "Bring it in", body: "The user adds what they already have: a file, a form, a few clicks." },
  { title: "We do the smart part", body: "The app analyses, organises or generates, so they don't have to." },
  { title: "Walk away with something useful", body: "A clear result they can act on, share or export." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">Open app</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-16 pb-20 md:grid-cols-[1.2fr_1fr] md:items-center md:px-6 md:pt-24">
          <div className="grid gap-6">
            <p className="w-fit rounded-full border px-3 py-1 text-xs text-muted-foreground">
              For one specific user. Name them here.
            </p>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight md:text-6xl">
              The problem, stated so plainly the judges nod.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">{site.tagline}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Try the demo <ArrowRightIcon />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how">How it works</Link>
              </Button>
            </div>
          </div>

          <div className="relative rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            </div>
            <div className="grid gap-3">
              {["Before: 3 hours of manual work", "After: 4 minutes, one screen", "Saved per week: 11 hours"].map((line, i) => (
                <div key={line} className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
                  <span className={`grid size-5 place-items-center rounded-full ${i === 2 ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                    <CheckIcon className="size-3" />
                  </span>
                  {line}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Placeholder numbers. Swap in the real before-and-after.</p>
          </div>
        </section>

        <section id="how" className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="grid content-start gap-2">
                  <span className="font-mono text-sm text-primary">0{i + 1}</span>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-muted-foreground md:px-6">
        © {new Date().getFullYear()} {site.name}
      </footer>
    </div>
  );
}
