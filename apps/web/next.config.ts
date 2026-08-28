import { join } from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "**/*": [
      "../../node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/esm/**",
    ],
  },
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.mzstatic.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
    ],
  },
};

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;

export default SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT
  ? withSentryConfig(nextConfig, {
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      authToken: SENTRY_AUTH_TOKEN,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      silent: !process.env.CI,
      telemetry: false,
    })
  : nextConfig;
