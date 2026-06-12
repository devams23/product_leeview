import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: "src/content/authBridge.ts",
      output: {
        entryFileNames: "authBridge.js",
        format: "iife",
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
