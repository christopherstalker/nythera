const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : [])
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  htmlLimitedBots: /.*/,
  serverExternalPackages: ["mammoth", "unpdf", "bullmq", "ioredis"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  images: {
    minimumCacheTTL: 86400
  },
  async redirects() {
    if (
      process.env.AUTH_URL === "https://nythera-ai-character-platform.vercel.app" ||
      process.env.NEXTAUTH_URL === "https://nythera-ai-character-platform.vercel.app"
    ) {
      return [];
    }

    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "nythera-ai-character-platform.vercel.app"
          }
        ],
        destination: "https://www.nythera.art/pwa-migrate?source=legacy-pwa&next=/:path*",
        permanent: false
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: isProduction ? "public, max-age=31536000, immutable" : "no-store"
          }
        ]
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate"
          },
          {
            key: "Service-Worker-Allowed",
            value: "/"
          }
        ]
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
