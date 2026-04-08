import express from "express";

export function createRouter({ store, matchTracker, discordBot, faceitService }) {
  const router = express.Router();

  router.get("/state", (_request, response) => {
    const state = store.getState();
    response.json({
      settings: state.settings,
      trackedPlayers: state.trackedPlayers,
      recentMatches: state.recentMatches,
      runtime: state.runtime,
      health: {
        faceitConfigured: faceitService.isConfigured(),
        discordConfigured: discordBot.isConfigured(),
        discordReady: discordBot.ready
      }
    });
  });

  router.post("/settings", async (request, response, next) => {
    try {
      const pollIntervalSeconds = clampNumber(request.body.pollIntervalSeconds, 30, 3600);
      const payload = {
        pollIntervalSeconds,
        discordChannelId: String(request.body.discordChannelId ?? "").trim(),
        gameId: String(request.body.gameId ?? "cs2").trim() || "cs2"
      };

      const state = await store.updateSettings(payload);
      response.json({ ok: true, settings: state.settings });
    } catch (error) {
      next(error);
    }
  });

  router.post("/players", async (request, response, next) => {
    try {
      const nickname = String(request.body.nickname ?? "").trim();
      if (!nickname) {
        response.status(400).json({ error: "Le pseudo FACEIT est obligatoire." });
        return;
      }

      const player = await matchTracker.addPlayer(nickname);
      response.status(201).json({ ok: true, player });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/players/:nickname", async (request, response, next) => {
    try {
      const result = await store.removeTrackedPlayerByNickname(request.params.nickname);
      if (!result.removed) {
        response.status(404).json({ error: "Joueur introuvable." });
        return;
      }

      response.json({ ok: true, removed: result.removed });
    } catch (error) {
      next(error);
    }
  });

  router.post("/check-now", async (_request, response, next) => {
    try {
      await matchTracker.checkNow();
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/check-now", (_request, response) => {
    response
      .status(405)
      .set("Allow", "POST")
      .json({ error: "Utilise une requete POST pour lancer une verification." });
  });

  router.post("/test-notification", async (_request, response, next) => {
    try {
      await matchTracker.sendTestNotification();
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/test-notification", (_request, response) => {
    response
      .status(405)
      .set("Allow", "POST")
      .json({ error: "Utilise une requete POST pour envoyer une notification de test." });
  });

  return router;
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(numeric)));
}
