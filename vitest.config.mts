import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    globals: true,
    // Scheduling is defined in local calendar days, so the suite pins a zone to stay
    // deterministic. Asia/Bangkok is the target audience's zone and has no DST.
    env: { TZ: "Asia/Bangkok" },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/index.ts"],
    },
  },
});
