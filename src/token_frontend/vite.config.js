import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
    "process.env.VITE_TOKEN_BACKEND_CANISTER_ID": JSON.stringify(
      process.env.VITE_TOKEN_BACKEND_CANISTER_ID ||
        "uxrrr-q7777-77774-qaaaq-cai"
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
