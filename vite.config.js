import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative Pfade (base: "./"), damit die gebaute App auch aus dem
// lokalen Dateisystem heraus funktioniert, wie es Capacitor auf Android tut.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
  },
});
