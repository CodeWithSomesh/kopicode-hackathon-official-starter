import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: classic dynamic rendering keeps
  // Supabase auth (cookies) simple for a 24-hour build. See CLAUDE.md.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  redirects: async () => [{ source: "/dashboard/:path*", destination: "/", permanent: false }],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
