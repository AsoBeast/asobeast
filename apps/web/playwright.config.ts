import { defineConfig, devices } from "@playwright/test";

const BASELINE = process.env.CAPTURE_BASELINE ? [] : ["**/baseline.spec.ts"];
const WEBKIT_SPECS = ["**/engine-hydration.spec.ts"];
const ACTION_STATE_SPECS = [
  "actions",
  "actions-queue",
  "actions-sheet",
  "actions-double-click",
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  projects: [
    {
      name: "app",
      testIgnore: [
        ...BASELINE,
        ...WEBKIT_SPECS,
        ...ACTION_STATE_SPECS.map((name) => `**/${name}.spec.ts`),
      ],
    },
    {
      name: "webkit",
      testMatch: WEBKIT_SPECS,
      use: { ...devices["Desktop Safari"] },
    },
    ...ACTION_STATE_SPECS.map((name, index) => ({
      name,
      testMatch: `**/${name}.spec.ts`,
      dependencies: ACTION_STATE_SPECS.slice(Math.max(0, index - 1), index),
    })),
  ],
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  webServer: [
    {
      command: "node e2e/mock-api.mts",
      port: 4100,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm build && pnpm start:standalone",
      port: 3000,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        API_INTERNAL_URL: "http://localhost:4100",
        API_PROXY_TIMEOUT_MS: "2000",
        SENTRY_DSN: "",
      },
    },
  ],
});
