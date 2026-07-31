import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Builds straight into the Frappe app's www/ folder so Frappe serves this
// SPA same-origin under /os/ (see alaiy_os/alaiy_os/www/os and the
// website_route_rules entry in hooks.py that maps deep links back to it).
// The dev server instead proxies API calls to the real bench so the browser
// only ever talks to one origin (localhost:5173) and session cookies land
// as same-origin — no CORS, no separate token layer, matching production.
const BENCH_URL = process.env.VITE_BENCH_URL || "http://vistara-ubuntu-wsl";

export default defineConfig({
  base: "/os/",
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BENCH_URL, changeOrigin: true },
      "/files": { target: BENCH_URL, changeOrigin: true },
      "/private": { target: BENCH_URL, changeOrigin: true },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../alaiy_os/www/os",
    emptyOutDir: true,
  },
});
