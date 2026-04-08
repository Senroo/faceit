import "dotenv/config";
import { DiscordBot } from "./services/discordBot.js";
import { FaceitService } from "./services/faceitService.js";
import { MatchTracker } from "./services/matchTracker.js";
import { NotificationService } from "./services/notificationService.js";
import { Store } from "./config/store.js";
import { createWebServer } from "./web/server.js";

const port = Number(process.env.PORT || 3000);
const dataDir = process.env.DATA_DIR || "./data";
const guildId = process.env.DISCORD_GUILD_ID || "";

const store = new Store({ dataDir });
await store.init();

const faceitService = new FaceitService(process.env.FACEIT_API_KEY);

let discordBot;
let notificationService;
let matchTracker;

discordBot = new DiscordBot({
  token: process.env.DISCORD_BOT_TOKEN,
  guildId,
  store,
  matchTracker: {
    addPlayer: (...args) => matchTracker.addPlayer(...args),
    checkNow: (...args) => matchTracker.checkNow(...args),
    sendTestNotification: (...args) => matchTracker.sendTestNotification(...args)
  }
});

notificationService = new NotificationService({
  discordClient: discordBot,
  store
});

matchTracker = new MatchTracker({
  store,
  faceitService,
  notificationService
});

const app = createWebServer({
  store,
  matchTracker,
  discordBot,
  faceitService
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`[web] dashboard disponible sur http://localhost:${port}`);
});

try {
  await discordBot.start();
} catch (error) {
  await store.setRuntime({
    lastError: `Discord: ${error.message}`
  });
  console.error("[discord] startup failed:", error);
}

matchTracker.start();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log(`[app] arret recu via ${signal}`);
    matchTracker.stop();
    await discordBot.stop();

    server.close(() => {
      process.exit(0);
    });
  });
}
