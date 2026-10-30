import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { drag, pinch } from "./test/commands";

export default defineConfig({
  test: {
    maxWorkers: 2,
    projects: [
      {
        test: {
          environment: "node",
          exclude: ["**/*.browser.test.*", "**/node_modules/**"],
          include: ["packages/*/test/**/*.test.ts"],
          name: "unit",
          setupFiles: ["packages/core/test/setup.ts"],
          testTimeout: 120_000,
        },
      },
      {
        plugins: [react()],
        test: {
          browser: {
            commands: { drag, pinch },
            enabled: true,
            headless: true,
            instances: [
              { browser: "chromium" },
              { browser: "firefox" },
              { browser: "webkit" },
            ],
            provider: playwright(),
          },
          include: ["packages/*/test/**/*.browser.test.{ts,tsx}"],
          name: "browser",
        },
      },
    ],
  },
});
