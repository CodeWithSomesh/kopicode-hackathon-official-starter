import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/app/providers";
import { LangProvider } from "@/lib/homelander/i18n/client";
import { getLang } from "@/lib/homelander/i18n/server";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
};

// Async so the language cookie (EN / Manglish) is read on the server: every route renders in the right language first time.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <LangProvider initial={lang}>
          <Providers>{children}</Providers>
        </LangProvider>
      </body>
    </html>
  );
}
