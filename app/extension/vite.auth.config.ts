import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: {
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(env.VITE_BACKEND_URL || "http://localhost:8000"),
      "import.meta.env.VITE_DASHBOARD_URL": JSON.stringify(env.VITE_DASHBOARD_URL || "http://localhost:5173"),
    },
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
  };
});
