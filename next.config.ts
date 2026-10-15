import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // Internal system: there is deliberately no public site at the root.
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // The pouch artwork in /public is not fingerprinted, but it changes only
        // on a deliberate redesign. Without this the browser revalidates every
        // image on every page load, which is most of the perceived slowness.
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;