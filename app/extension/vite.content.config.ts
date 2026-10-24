import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_DEEPGRAM_API_KEY": JSON.stringify(env.VITE_DEEPGRAM_API_KEY),
      "DEEPGRAM_API_KEY": JSON.stringify(env.VITE_DEEPGRAM_API_KEY),
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(env.VITE_BACKEND_URL || "http://localhost:8000"),
      "import.meta.env.VITE_DASHBOARD_URL": JSON.stringify(env.VITE_DASHBOARD_URL || "http://localhost:5173"),
    },
    build: {
      // Inline font files as data URIs so the content script has no network dependency for fonts.
      assetsInlineLimit: 1_000_000,
      rollupOptions: {
        input: "src/content/main.tsx",
        output: {
          entryFileNames: "content.js",
          format: "iife",
        },
      },
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
