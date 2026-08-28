import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Builds ONE self-contained IIFE bundle (no code-splitting, no import map --
// hooks.py's app_include_js just drops a <script> tag on every Desk page, so
// there is nowhere for a second chunk to be fetched from) into this app's own
// public/dist/, which Frappe serves as a static asset at
// /assets/alaiy_os/dist/ask_alaiy.{js,css}. See hooks.py's app_include_js/css
// for where it's wired in, and src/main.tsx for the mount/guard logic.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../alaiy_os/public/dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      name: "AlaiyAskAlaiyWidget",
      formats: ["iife"],
      fileName: () => "ask_alaiy.js",
    },
    rollupOptions: {
      output: {
        // Only ever meaningful if lib mode ever needs a second asset name --
        // the widget's CSS still needs a fixed name because hooks.py
        // references it literally.
        assetFileNames: (info) => (info.name?.endsWith(".css") ? "ask_alaiy.css" : "[name][extname]"),
      },
    },
  },
  server: {
    port: 8090,
  },
});
