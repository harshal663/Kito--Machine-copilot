import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

export default defineConfig({
  testDir: path.resolve(__dirname, "tests/e2e"),
  testMatch: /.*\.spec\.ts$/,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
