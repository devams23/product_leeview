import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_DEEPGRAM_API_KEY": JSON.stringify("29fc25e46278b60fb94ad2eb0906d798549f638d"),
    "DEEPGRAM_API_KEY": JSON.stringify("29fc25e46278b60fb94ad2eb0906d798549f638d"),
  },
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        popup: resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
        format: "es",
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
