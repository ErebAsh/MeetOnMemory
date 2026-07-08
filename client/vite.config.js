import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";

const useLocalHttps =
  fs.existsSync("localhost-key.pem") && fs.existsSync("localhost.pem");

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    https: useLocalHttps
      ? {
          key: fs.readFileSync("localhost-key.pem"),
          cert: fs.readFileSync("localhost.pem"),
        }
      : false,
    port: 5173,
  },
});
