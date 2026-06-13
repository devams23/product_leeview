import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_DEEPGRAM_API_KEY": JSON.stringify("29fc25e46278b60fb94ad2eb0906d798549f638d"),
    "DEEPGRAM_API_KEY": JSON.stringify("29fc25e46278b60fb94ad2eb0906d798549f638d"),
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
});
