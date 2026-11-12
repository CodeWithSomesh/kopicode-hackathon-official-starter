"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/**
 * RPG dialog text that types out in steps, two characters a tick. Remount it (change `key`)
 * for each new line. With reduced motion the whole line shows at once.
 */
export function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const done = reduced || shown >= text.length;

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 2;
      });
    }, 32);
    return () => window.clearInterval(id);
  }, [text, reduced]);

  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);

  return (
    <>
      <span aria-hidden>
        {done ? text : text.slice(0, shown)}
        {done ? null : <span className="invisible">{text.slice(shown)}</span>}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}
