import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Vitest's own default exclude list, plus `obsolete/` - superseded code
    // kept only as a recovery reference (see interface/obsolete's own
    // note), not part of the build or test suite. Setting `exclude` at all
    // replaces Vitest's default rather than extending it, so the defaults
    // are repeated here.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cjs,mocha,eslint,prettier}.config.*",
      "**/obsolete/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
