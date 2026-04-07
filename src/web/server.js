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

  app.use((error, request, response, _next) => {
    const status = getHttpStatus(error);
    console.error(`[web] ${request.method} ${request.path} failed:`, error);
    response.status(status).json({
      error: error.message || "Erreur serveur."
    });
  });

  return app;
}

function getHttpStatus(error) {
  const message = String(error?.message ?? "");

  if (
    message.includes("obligatoire") ||
    message.includes("manquante") ||
    message.includes("non configure") ||
    message.includes("Definis un salon")
  ) {
    return 400;
  }

  if (
    message.includes("introuvable") ||
    message.includes("Impossible de recuperer le salon Discord configure")
  ) {
    return 404;
  }

  if (
    message.includes("Bot Discord hors ligne") ||
    message.includes("invalide ou refusee")
  ) {
    return 503;
  }

  return 500;
}
