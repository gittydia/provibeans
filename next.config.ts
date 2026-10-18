import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server refuses to hand its runtime to an unrecognised origin, and
  // the failure is silent: the page still renders from HTML, but React never
  // hydrates, so the sign-in form falls back to a native GET submit and no
  // amount of typing appears to work. Reaching this machine over Tailscale
  // makes the browser origin the tailnet IP rather than localhost, so that
  // origin has to be named here. Read it back with `tailscale ip -4`.
  allowedDevOrigins: ["100.74.247.73"],
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