import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_DEEPGRAM_API_KEY": JSON.stringify(env.VITE_DEEPGRAM_API_KEY),
      "DEEPGRAM_API_KEY": JSON.stringify(env.VITE_DEEPGRAM_API_KEY),
    },
    build: {
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
