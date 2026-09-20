import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Layering: app -> components -> hooks -> stores -> lib/db/repositories -> lib/*
 * The pure-domain packages (answer, srs, exercises, gamification) must stay free of
 * React and IndexedDB so they remain fast and trivial to unit test.
 */
const PURE_DOMAIN = ["src/lib/answer/**", "src/lib/srs/**", "src/lib/exercises/**", "src/lib/gamification/**"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: PURE_DOMAIN,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "Pure domain modules must not import React." },
            { name: "react-dom", message: "Pure domain modules must not import React." },
            { name: "zustand", message: "Pure domain modules must not hold UI state." },
            { name: "idb", message: "Pure domain modules must not touch IndexedDB." },
          ],
          patterns: [
            { group: ["@/lib/db/*", "@/lib/db"], message: "Pure domain modules take values in and return values out; persistence belongs to repositories." },
            { group: ["@/components/*", "@/stores/*", "@/hooks/*", "@/app/*"], message: "Pure domain modules must not depend on the UI layer." },
          ],
        },
      ],
    },
  },

  {
    files: ["src/lib/db/repositories/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/components/*", "@/stores/*", "@/hooks/*", "@/app/*"], message: "Repositories are the persistence boundary and must not depend on the UI layer." },
          ],
        },
      ],
    },
  },

  {
    files: ["src/components/**", "src/app/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["idb", "@/lib/db/client"], message: "Go through a repository in src/lib/db/repositories instead of opening the database directly." },
          ],
        },
      ],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**", "coverage/**"]),
]);

export default eslintConfig;
