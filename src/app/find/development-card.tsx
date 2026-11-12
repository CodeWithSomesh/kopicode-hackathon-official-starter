import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SOURCE } from "@/lib/first-key/developments";
import type { Development } from "@/lib/first-key/types";

/** Facts about a real Gamuda Land development; the unit numbers in the 3D view stay made up. */
export function DevelopmentCard({ dev, isCove, onBack }: { dev: Development; isCove: boolean; onBack: () => void }) {
  return (
    <aside
      className="absolute bottom-4 left-4 right-4 z-[5] max-w-sm rounded-xl border bg-card p-4 text-card-foreground shadow-lg sm:right-auto"
      aria-label={`${dev.name} details`}
    >
      <h2 className="text-base font-semibold">{dev.name}</h2>
      <p className="text-sm text-muted-foreground">
        {dev.town}
        {dev.acres ? ` · ${dev.acres.toLocaleString()} acres` : ""}
      </p>
      <p className="mt-2 text-sm">{dev.blurb}</p>
      {dev.launch && (
        <p className="mt-2 text-sm">
          <strong>{dev.launch.name}</strong>: {dev.launch.type}, from <strong>RM{dev.launch.fromPrice.toLocaleString()}</strong>
        </p>
      )}
      {isCove && (
        <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-xs">
          The glass block on the map is an illustrative block at Gamuda Cove. Its units and prices are made up. Tap a block to open it up.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Source: {SOURCE.site}, {SOURCE.retrieved}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <a href={dev.url} target="_blank" rel="noopener noreferrer">
            Development page <ExternalLink aria-hidden />
          </a>
        </Button>
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden /> All developments
        </Button>
      </div>
    </aside>
  );
}
