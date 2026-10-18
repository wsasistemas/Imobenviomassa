import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    // Plugin (e não resolve.tsconfigPaths/alias nativos): com a resolução nativa, a proteção de
    // imports do TanStack Start barra em dev os import("@/lib/*.server") dinâmicos de authz.ts e
    // *.functions.ts. O aviso do Vite sugerindo trocar pelo nativo pode ser ignorado.
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**", "**/*.server.ts"],
          specifiers: ["server-only"],
        },
      },
      // Usa src/server.ts (wrapper de erro do SSR) como entry do servidor.
      server: { entry: "server" },
    }),
    // Gera a saída no formato Build Output API da Vercel (.vercel/output).
    nitro({ preset: "vercel" }),
    viteReact(),
  ],
});
