import express from "express";
import path from "node:path";
import { createRouter } from "./routes.js";

export function createWebServer(services) {
  const app = express();
  const publicDir = path.resolve(process.cwd(), "public");

  app.use(express.json());
  app.get("/health", (_request, response) => {
    response.status(200).json({ ok: true });
  });
  app.use(express.static(publicDir));
  app.use("/api", createRouter(services));

  app.use((error, _request, response, _next) => {
    console.error("[web] request error:", error);
    response.status(500).json({
      error: error.message || "Erreur serveur."
    });
  });

  return app;
}
