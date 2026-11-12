import { Archivo_Black, Bricolage_Grotesque, Fredoka, Nunito, Pixelify_Sans, Silkscreen, Unbounded } from "next/font/google";

const pixelify = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixelify", weight: ["400", "500", "600", "700"] });
const silkscreen = Silkscreen({ subsets: ["latin"], variable: "--font-silkscreen", weight: ["400", "700"] });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["500", "600", "700", "800", "900"] });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["400", "500", "600", "700", "800"] });

const archivoBlack = Archivo_Black({ subsets: ["latin"], variable: "--font-archivo-black", weight: "400" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["400", "500", "600", "700"] });
const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded", weight: ["500", "600", "700", "800"] });

/** Every face the themes use; the theme CSS points --font-pixel / --font-pixel-label / body at the right ones. */
export const homelanderFontClass = [pixelify, silkscreen, nunito, bricolage, archivoBlack, fredoka, unbounded].map((f) => f.variable).join(" ");
