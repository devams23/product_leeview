// Values are injected at build time by the vite configs (see `define` blocks).
export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) || "http://localhost:8000";

// http -> ws, https -> wss
export const WS_URL: string = BACKEND_URL.replace(/^http/, "ws");

export const DASHBOARD_URL: string =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined) || "http://localhost:5173";
