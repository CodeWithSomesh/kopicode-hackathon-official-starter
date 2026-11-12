import { cn } from "@/lib/utils";

/**
 * Mochi, HomeLander's helper: a soft white rice cake with a pandan-leaf sprout, two bright oval
 * eyes, rosy cheeks and little stub arms. One squat, squishy blob (wider than tall, no separate
 * head, no legs), drawn as smooth SVG in the theme's colours so it re-skins with the theme.
 *
 * States: idle (breathes and blinks), listening (looks up, a soft ring pulses), thinking (tilts,
 * three dots), speaking (mouth moves; drive it from the audio's play/ended) and happy (^ ^ eyes,
 * a little wave). Every animation stops under prefers-reduced-motion.
 */
export type MochiState = "idle" | "listening" | "thinking" | "speaking" | "happy";

const labels: Record<MochiState, string> = {
  idle: "Mochi, a round white rice-cake bot with a leaf sprout, smiling",
  listening: "Mochi listening, looking up",
  thinking: "Mochi thinking, head tilted",
  speaking: "Mochi talking",
  happy: "Mochi happy, eyes curved into smiles",
};

/** Scoped keyframes, hoisted and de-duplicated by React 19 (one copy however many Mochis render). */
const css = `
.mochi-bot .m-body{transform-box:fill-box;transform-origin:50% 100%;animation:mochi-breathe 3.4s ease-in-out infinite}
.mochi-bot .m-shadow{transform-box:fill-box;transform-origin:50% 50%;animation:mochi-shadow 3.4s ease-in-out infinite}
.mochi-bot .m-eye{transform-box:fill-box;transform-origin:50% 50%;animation:mochi-blink 4.6s infinite}
.mochi-bot .m-eye.r{animation-delay:.02s}
.mochi-bot .m-face{transition:transform .35s cubic-bezier(.3,.7,.4,1)}
.mochi-bot .m-leaf{transform-box:view-box;transform-origin:100px 60px;animation:mochi-sway 5s ease-in-out infinite}
.mochi-bot[data-state=listening] .m-face{transform:translateY(-6px)}
.mochi-bot .m-ring{transform-box:fill-box;transform-origin:50% 50%;opacity:0}
.mochi-bot[data-state=listening] .m-ring{animation:mochi-ring 1.8s ease-out infinite}
.mochi-bot[data-state=listening] .m-ring.b{animation-delay:.9s}
.mochi-bot .m-tilt{transform-box:view-box;transform-origin:100px 180px;transition:transform .45s cubic-bezier(.3,.7,.4,1)}
.mochi-bot[data-state=thinking] .m-tilt{transform:rotate(-6deg)}
.mochi-bot[data-state=thinking] .m-face{transform:translate(-4px,-3px)}
.mochi-bot .m-dot{animation:mochi-dot 1.2s ease-in-out infinite}
.mochi-bot .m-dot.b{animation-delay:.2s}
.mochi-bot .m-dot.c{animation-delay:.4s}
.mochi-bot .m-talk{transform-box:fill-box;transform-origin:50% 0;animation:mochi-talk .28s ease-in-out infinite alternate}
.mochi-bot[data-state=happy] .m-body{animation:mochi-hop .9s cubic-bezier(.3,.7,.4,1) 2}
.mochi-bot .m-arm{transform-box:fill-box}
.mochi-bot .m-arm.l{transform-origin:100% 40%}
.mochi-bot .m-arm.r{transform-origin:0 40%}
.mochi-bot[data-state=happy] .m-arm.r{animation:mochi-wave .5s ease-in-out 4 alternate}
.mochi-bot[data-state=speaking] .m-arm.l{animation:mochi-nudge .9s ease-in-out infinite alternate}
@keyframes mochi-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,.965)}}
@keyframes mochi-shadow{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes mochi-blink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
@keyframes mochi-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}
@keyframes mochi-ring{0%{opacity:.55;transform:scale(.92)}100%{opacity:0;transform:scale(1.12)}}
@keyframes mochi-dot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
@keyframes mochi-talk{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
@keyframes mochi-hop{0%,100%{transform:translateY(0) scale(1,1)}30%{transform:translateY(0) scale(1.06,.92)}60%{transform:translateY(-8px) scale(.97,1.04)}}
@keyframes mochi-wave{from{transform:rotate(0)}to{transform:rotate(-28deg)}}
@keyframes mochi-nudge{from{transform:rotate(0)}to{transform:rotate(14deg)}}
@media (prefers-reduced-motion:reduce){.mochi-bot *{animation:none!important;transition:none!important}}
`;

export function MochiBot({
  state = "idle",
  size = 200,
  className,
  label,
}: {
  state?: MochiState;
  /** Width and height in CSS px. */
  size?: number;
  className?: string;
  /** Accessible name; pass "" to hide it from screen readers when a caption already says it. */
  label?: string;
}) {
  const name = label ?? labels[state];
  const happy = state === "happy";
  return (
    <>
      <style href="homelander-mochi-bot" precedence="default">
        {css}
      </style>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        data-state={state}
        className={cn("mochi-bot overflow-visible", className)}
        role={name ? "img" : undefined}
        aria-label={name || undefined}
        aria-hidden={name ? undefined : true}
      >
        <defs>
          <clipPath id="mochi-body-clip">
            <path d="M28 148C28 96 60 64 100 64s72 32 72 84c0 22-22 32-72 32s-72-10-72-32Z" />
          </clipPath>
        </defs>

        {/* Listening ring */}
        <ellipse className="m-ring" cx="100" cy="124" rx="88" ry="70" fill="none" stroke="var(--color-pandan)" strokeWidth="3" />
        <ellipse className="m-ring b" cx="100" cy="124" rx="88" ry="70" fill="none" stroke="var(--color-pandan)" strokeWidth="3" />

        <ellipse className="m-shadow" cx="100" cy="186" rx="60" ry="7" fill="var(--color-ink)" opacity="0.12" />

        <g className="m-tilt">
          <g className="m-body">
            {/* Stub arms, tucked behind the body */}
            <path className="m-arm l" d="M36 136c-12-2-20 6-17 14 3 7 13 7 19 1" fill="#ffffff" stroke="var(--color-ink)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            <path className="m-arm r" d="M164 136c12-2 20 6 17 14-3 7-13 7-19 1" fill="#ffffff" stroke="var(--color-ink)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />

            {/* Pandan sprout */}
            <g className="m-leaf">
              <path d="M100 66c0-8 0-14 2-20" fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" />
              <path d="M102 48c4-14 18-20 30-16-4 13-17 20-30 16Z" fill="var(--color-pandan)" stroke="var(--color-ink)" strokeWidth="3.5" strokeLinejoin="round" />
              <path d="M101 52c-6-10-17-12-25-8 5 10 15 12 25 8Z" fill="var(--color-pandan)" stroke="var(--color-ink)" strokeWidth="3.5" strokeLinejoin="round" />
            </g>

            {/* The rice cake */}
            <path d="M28 148C28 96 60 64 100 64s72 32 72 84c0 22-22 32-72 32s-72-10-72-32Z" fill="#ffffff" />
            <g clipPath="url(#mochi-body-clip)">
              {/* Soft cloud shading underneath and on the right, a dusting of rice flour on top */}
              <ellipse cx="112" cy="190" rx="92" ry="34" fill="var(--color-cloud)" />
              <ellipse cx="182" cy="140" rx="30" ry="70" fill="var(--color-cloud)" />
              <ellipse cx="70" cy="86" rx="16" ry="7" fill="var(--color-sky-deep)" opacity="0.22" transform="rotate(-24 70 86)" />
            </g>
            <path d="M28 148C28 96 60 64 100 64s72 32 72 84c0 22-22 32-72 32s-72-10-72-32Z" fill="none" stroke="var(--color-ink)" strokeWidth="4.5" strokeLinejoin="round" />

            <g className="m-face">
              {/* Cheeks */}
              <ellipse cx="62" cy="136" rx="11" ry="6.5" fill="var(--color-raya)" opacity="0.28" />
              <ellipse cx="138" cy="136" rx="11" ry="6.5" fill="var(--color-raya)" opacity="0.28" />

              {happy ? (
                <g fill="none" stroke="var(--color-ink)" strokeWidth="4.5" strokeLinecap="round">
                  <path d="M70 124q8-12 16 0" />
                  <path d="M114 124q8-12 16 0" />
                </g>
              ) : (
                <>
                  <g className="m-eye">
                    <ellipse cx="78" cy="120" rx="7.5" ry="10" fill="var(--color-ink)" />
                    <circle cx="80.5" cy="116" r="2.6" fill="#ffffff" />
                  </g>
                  <g className="m-eye r">
                    <ellipse cx="122" cy="120" rx="7.5" ry="10" fill="var(--color-ink)" />
                    <circle cx="124.5" cy="116" r="2.6" fill="#ffffff" />
                  </g>
                </>
              )}

              {state === "speaking" ? (
                <ellipse className="m-talk" cx="100" cy="139" rx="6" ry="5" fill="var(--color-ink)" />
              ) : state === "thinking" ? (
                <path d="M95 140h9" fill="none" stroke="var(--color-ink)" strokeWidth="3.5" strokeLinecap="round" />
              ) : (
                <path
                  d={happy ? "M92 135q8 10 16 0" : "M94 136q6 6 12 0"}
                  fill={happy ? "var(--color-ink)" : "none"}
                  stroke="var(--color-ink)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          </g>
        </g>

        {/* Thinking dots */}
        {state === "thinking" ? (
          <g fill="var(--color-kaya)" stroke="var(--color-ink)" strokeWidth="2.5">
            <circle className="m-dot" cx="150" cy="50" r="5" />
            <circle className="m-dot b" cx="166" cy="38" r="6" />
            <circle className="m-dot c" cx="184" cy="24" r="7" />
          </g>
        ) : null}
      </svg>
    </>
  );
}
