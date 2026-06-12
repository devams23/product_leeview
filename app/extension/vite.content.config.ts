import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
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
