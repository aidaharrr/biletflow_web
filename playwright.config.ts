import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3011",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/mock-api.mjs",
      url: "http://127.0.0.1:8011/api/v1/health",
      reuseExistingServer: false,
    },
    {
      command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run start -- --hostname 127.0.0.1 --port 3011`,
      url: "http://127.0.0.1:3011/events",
      reuseExistingServer: false,
      env: {
        API_BASE_URL: "http://127.0.0.1:8011/api/v1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
