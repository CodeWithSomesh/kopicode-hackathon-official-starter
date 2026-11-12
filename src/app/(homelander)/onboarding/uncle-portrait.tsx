import { Sprite, defineSprite } from "@/components/homelander/sprite";
import { cn } from "@/lib/utils";

/**
 * Uncle, 24x24: an original kopitiam uncle. Shiny bald dome with one brave comb-over strand,
 * grey sides, thick black glasses, bushy grey brows, grey moustache, white singlet, a striped
 * kopitiam towel over his shoulder, and a kopi in a green-rimmed cup (this screen's one hidden kopi).
 * "#" is ink (currentColor). Each mood swaps only the brow, eye and mouth rows.
 */
const colors = {
  s: "#e0a77a", // skin
  d: "#b97c55", // skin shadow
  h: "#c9c4d6", // grey hair
  b: "#8a8496", // brows
  m: "#8a8496", // moustache
  l: "#d6efff", // lens
  e: "#2b1d3f", // eye
  o: "#5b1e2a", // open mouth
  t: "#ffffff", // teeth
  y: "#f08a8a", // blush
  q: "#6cbcf2", // sweat drop
  w: "#ffffff", // singlet
  x: "#ffffff", // towel
  r: "#ef4560", // towel stripe
  p: "#3fbf5f", // cup rim
  c: "#ffffff", // cup
  k: "#a0612f", // kopi
  v: "#c9c4d6", // steam
};

// prettier-ignore
const base = [
  "........#######.........", //  0 bald dome
  "......##sssssss##.......", //  1
  ".....#sssssssssss#......", //  2
  "....#sshhhhhhsssss#.....", //  3 the comb-over
  "....#hsssssssbbbsh#.....", //  4 brows (right one raised: cheeky)
  "....#hbbbssssssssh#.....", //  5
  "....#h#####s#####h#.....", //  6 glasses
  "..#ss##lel###lel##ss#...", //  7 eyes
  "..#ssh#lll#s#lll#hss#...", //  8
  "...#sh#####s#####hs#....", //  9
  "....#ssssssdssssss#.....", // 10 nose
  "....#sssmmmmmmmsss#.....", // 11 moustache
  "....#ssssss###ssss#.....", // 12 mouth (smirk)
  ".....#sssssssssss#......", // 13 chin
  "......##sssssss##.......", // 14 neck
  "..#xxxx#sssssss#ssss#.v.", // 15 towel, shoulders, steam
  ".#xxxxx#wsssssw#sssss#.v", // 16
  "#xxxxxx#wwsssww#ssssd#v.", // 17
  "#xxxxxx#wwwwwww#ss######", // 18 cup top
  "#xrrrrx#wwwwwww#ss#kkkk#", // 19 kopi
  "#xxxxxx#wwwwwww#ssssppp#", // 20 hand on the cup
  "#xrrrrx#wwwwwww#sdssccc#", // 21
  "#xxxxxx#wwwwwww##ss#ccc#", // 22
  "#xxxxxx#wwwwwww#ss######", // 23
];

/** Rows 0-14 of the head, row index -> replacement. */
type Face = Record<number, string>;
const head = (inner: string, ear = false) => (ear ? `..#ss${inner}ss#...` : `....#${inner}#.....`);
const chin = (inner: string) => `.....#${inner}#......`;

const faces = {
  // Cheeky: one brow up, smirk off to the side.
  neutral: {} as Face,
  neutralTalk: { 12: head("ssss#ooo#ssss") } as Face,
  // Haiyaa: brows shoot up, eyes screwed shut behind the glasses, mouth wide open, sweat drop.
  haiyaa: {
    3: "....#sshhhhhhsssss#..q..",
    4: "....#hsbbbsssbbbsh#.qq..",
    5: "....#hsssssssssssh#.qq..",
    7: head("##ele###ele##", true),
    8: head("h#lel#s#lel#h", true),
    12: head("sss#ooooo#sss"),
    13: chin("sss#ooo#sss"),
  } as Face,
  haiyaaTalk: {
    3: "....#sshhhhhhsssss#..q..",
    4: "....#hsbbbsssbbbsh#.qq..",
    5: "....#hsssssssssssh#.qq..",
    7: head("##ele###ele##", true),
    8: head("h#lel#s#lel#h", true),
    12: head("ssss#ooo#ssss"),
  } as Face,
  // Happy: both brows up, smiling eyes, blush and a big toothy grin.
  happy: {
    4: head("hsbbbsssbbbsh"),
    5: head("hsssssssssssh"),
    8: head("h#ele#s#ele#h", true),
    10: head("syysssdsssyys"),
    12: head("sss#ttttt#sss"),
    13: chin("sss#####sss"),
  } as Face,
  happyTalk: {
    4: head("hsbbbsssbbbsh"),
    5: head("hsssssssssssh"),
    8: head("h#ele#s#ele#h", true),
    10: head("syysssdsssyys"),
    12: head("sss#ttttt#sss"),
    13: chin("sss#ooo#sss"),
  } as Face,
};

const frame = (face: Face) => defineSprite(base.map((row, y) => face[y] ?? row), colors);

export type UncleMood = "neutral" | "haiyaa" | "happy";

const art: Record<UncleMood, { still: ReturnType<typeof frame>; talk: ReturnType<typeof frame> }> = {
  neutral: { still: frame(faces.neutral), talk: frame(faces.neutralTalk) },
  haiyaa: { still: frame(faces.haiyaa), talk: frame(faces.haiyaaTalk) },
  happy: { still: frame(faces.happy), talk: frame(faces.happyTalk) },
};

const labels: Record<UncleMood, string> = {
  neutral: "Uncle, a pixel kopitiam uncle in a singlet and thick glasses, one eyebrow raised, holding a kopi",
  haiyaa: "Uncle squeezing his eyes shut in exasperation, mouth wide open",
  happy: "Uncle grinning with approval",
};

/** Exasperated interjections (EN/Manglish, BM, 中文, தமிழ்) put Uncle's "haiyaa" face on. */
const HAIYAA = /(^|[^a-z])(hai+y+a+h?|aiy+o+h?|aiya+h?|walao+|walau+|wah+ ?lau+|wah+ ?lao+|alamak|aduh+|adoi+)([^a-z]|$)|哎呀|哎哟|唉|天啊|ஐயோ|அய்யோ/i;
/** Impressed interjections put on the happy face. */
const HAPPY = /(^|[^a-z])(wah+|fuyo+h?|shiok|steady|bagus|syok|power lah|well done|very good)([^a-z]|$)|哇|不错|厉害|好棒|சூப்பர்|அருமை/i;

/** Which face Uncle pulls for a line he says. */
export function moodOf(text: string): UncleMood {
  if (HAIYAA.test(text)) return "haiyaa";
  if (HAPPY.test(text)) return "happy";
  return "neutral";
}

export function UnclePortrait({
  speaking,
  mood = "neutral",
  scale = 10,
  className,
}: {
  speaking: boolean;
  mood?: UncleMood;
  scale?: number;
  className?: string;
}) {
  const a = art[mood];
  return (
    <div
      className={cn("relative animate-[pix-bob_1.4s_steps(2)_infinite]", className)}
      style={{ width: 24 * scale, height: 24 * scale }}
    >
      <Sprite art={a.still} scale={scale} label={labels[mood]} className="text-ink" />
      {speaking ? (
        <Sprite
          art={a.talk}
          scale={scale}
          className="absolute inset-0 animate-[pix-blink_0.32s_steps(1)_infinite] text-ink"
        />
      ) : null}
    </div>
  );
}
