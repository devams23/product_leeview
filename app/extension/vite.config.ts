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
  };
});
