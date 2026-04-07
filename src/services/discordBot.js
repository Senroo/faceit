import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Partials
} from "discord.js";

export class DiscordBot {
  constructor({ token, commandPrefix, store, matchTracker }) {
    this.token = token;
    this.commandPrefix = commandPrefix;
    this.store = store;
    this.matchTracker = matchTracker;
    this.client = null;
    this.ready = false;
  }

  isConfigured() {
    return Boolean(this.token);
  }

  async start() {
    if (!this.token) {
      console.warn("[discord] DISCORD_BOT_TOKEN manquant, bot non demarre.");
      return;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: [Partials.Channel]
    });

    this.client.once("ready", () => {
      this.ready = true;
      console.log(`[discord] connecte en tant que ${this.client.user.tag}`);
    });

    this.client.on("messageCreate", async (message) => {
      if (message.author.bot || !message.guild || !message.content.startsWith(this.commandPrefix)) {
        return;
      }

      try {
        await this.handleCommand(message);
      } catch (error) {
        console.error("[discord] command error:", error);
        await message.reply(`Erreur: ${error.message}`);
      }
    });

    await this.client.login(this.token);
  }

  async fetchTextChannel(channelId) {
    if (!this.client || !channelId) {
      return null;
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }

    return channel;
  }

  async stop() {
    if (!this.client) {
      return;
    }

    await this.client.destroy();
    this.ready = false;
  }

  async handleCommand(message) {
    const parts = message.content
      .slice(this.commandPrefix.length)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const command = (parts.shift() ?? "help").toLowerCase();

    switch (command) {
      case "help":
        await message.reply(this.buildHelpMessage());
        break;
      case "status":
        await message.reply(this.buildStatusMessage());
        break;
      case "players":
      case "list":
        await message.reply(this.buildPlayersMessage());
        break;
      case "add":
      case "track":
        await this.handleAddCommand(message, parts);
        break;
      case "remove":
      case "untrack":
        await this.handleRemoveCommand(message, parts);
        break;
      case "channel":
        await this.handleChannelCommand(message);
        break;
      case "check":
        await message.reply("Verification FACEIT en cours...");
        await this.matchTracker.checkNow();
        await message.channel.send("Verification terminee.");
        break;
      case "test":
        await this.matchTracker.sendTestNotification();
        await message.reply("Notification de test envoyee.");
        break;
      default:
        await message.reply(`Commande inconnue. Utilise \`${this.commandPrefix} help\`.`);
    }
  }

  buildHelpMessage() {
    return [
      `Commandes disponibles avec \`${this.commandPrefix}\` :`,
      "help - affiche cette aide",
      "status - etat du bot et du suivi",
      "players - liste les joueurs suivis",
      "add <pseudo> - ajoute un joueur FACEIT",
      "remove <pseudo> - retire un joueur FACEIT",
      "channel - definit le salon actuel pour les notifications",
      "check - force une verification immediate",
      "test - envoie une notification de test"
    ].join("\n");
  }

  buildStatusMessage() {
    const state = this.store.getState();
    const runtime = state.runtime;

    return [
      "Etat du FACEIT tracker :",
      `Joueurs suivis: ${state.trackedPlayers.length}`,
      `Salon de notif: ${state.settings.discordChannelId || "non configure"}`,
      `Intervalle: ${state.settings.pollIntervalSeconds}s`,
      `Dernier check: ${runtime.lastSuccessfulPollAt || "jamais"}`,
      `Derniere erreur: ${runtime.lastError || "aucune"}`
    ].join("\n");
  }

  buildPlayersMessage() {
    const players = this.store.getState().trackedPlayers;
    if (!players.length) {
      return "Aucun joueur suivi pour le moment.";
    }

    return players
      .map(
        (player) =>
          `- ${player.nickname} (${player.gameId}, level ${player.skillLevel ?? "?"}, elo ${player.elo ?? "?"})`
      )
      .join("\n");
  }

  async handleAddCommand(message, parts) {
    const nickname = parts.join(" ").trim();
    if (!nickname) {
      await message.reply(`Usage: \`${this.commandPrefix} add <pseudo>\``);
      return;
    }

    const player = await this.matchTracker.addPlayer(nickname);
    await message.reply(`Suivi active pour **${player.nickname}**.`);
  }

  async handleRemoveCommand(message, parts) {
    const nickname = parts.join(" ").trim();
    if (!nickname) {
      await message.reply(`Usage: \`${this.commandPrefix} remove <pseudo>\``);
      return;
    }

    const result = await this.store.removeTrackedPlayerByNickname(nickname);
    if (!result.removed) {
      await message.reply(`Aucun joueur suivi ne correspond a **${nickname}**.`);
      return;
    }

    await message.reply(`Suivi supprime pour **${result.removed.nickname}**.`);
  }

  async handleChannelCommand(message) {
    await this.store.updateSettings({
      discordChannelId: message.channelId
    });

    await message.reply(`Les notifications seront envoyees dans <#${message.channelId}>.`);
  }
}
