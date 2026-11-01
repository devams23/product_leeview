import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: "src/content/editorBridge.ts",
      output: {
        entryFileNames: "editorBridge.js",
        format: "iife",
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
