import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang, type Lang } from "./config";
import { translate, type TFn } from "./translate";

/** For Server Components, route handlers and generateMetadata: `const t = await getT(); t("About")`. */
export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getT(): Promise<TFn> {
  const lang = await getLang();
  return (en, vars) => translate(lang, en, vars);
}
