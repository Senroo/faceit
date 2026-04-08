import {
  ChannelType,
  Client,
  GatewayIntentBits,
  SlashCommandBuilder
} from "discord.js";
import { buildDashboardSummary } from "./performanceSummary.js";

export class DiscordBot {
  constructor({ token, guildId, store, matchTracker }) {
    this.token = token;
    this.guildId = guildId;
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
      intents: [GatewayIntentBits.Guilds]
    });

    this.client.once("ready", async () => {
      this.ready = true;
      console.log(`[discord] connecte en tant que ${this.client.user.tag}`);

      try {
        await this.registerSlashCommands();
      } catch (error) {
        await this.store.setRuntime({
          lastError: `Discord commands: ${error.message}`
        });
        console.error("[discord] slash command registration failed:", error);
      }
    });

    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand() || interaction.commandName !== "faceit") {
        return;
      }

      try {
        await this.handleCommand(interaction);
      } catch (error) {
        console.error("[discord] interaction error:", error);
        const payload = {
          content: `Erreur: ${error.message}`,
          ephemeral: true
        };

        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      }
    });

    await this.client.login(this.token);
  }

  async registerSlashCommands() {
    if (!this.client?.application) {
      throw new Error("Application Discord indisponible pour enregistrer les commandes.");
    }

    const command = buildFaceitCommand().toJSON();

    if (this.guildId) {
      const guild = await this.client.guilds.fetch(this.guildId);
      await guild.commands.set([command]);
      console.log(`[discord] slash commands enregistrees sur le serveur ${this.guildId}`);
      return;
    }

    await this.client.application.commands.set([command]);
    console.log("[discord] slash commands enregistrees globalement");
  }

  async fetchTextChannel(channelId) {
    if (!this.client || !channelId) {
      return null;
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel) {
      return null;
    }

    const supportedTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
    if (!supportedTypes.includes(channel.type)) {
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

  async handleCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "help":
        await interaction.reply({
          content: buildHelpMessage(),
          ephemeral: true
        });
        break;
      case "status":
        await interaction.reply({
          content: this.buildStatusMessage(),
          ephemeral: true
        });
        break;
      case "players":
        await interaction.reply({
          content: this.buildPlayersMessage(),
          ephemeral: true
        });
        break;
      case "leaderboard":
        await interaction.reply({
          content: this.buildLeaderboardMessage(),
          ephemeral: true
        });
        break;
      case "add":
        await this.handleAddCommand(interaction);
        break;
      case "remove":
        await this.handleRemoveCommand(interaction);
        break;
      case "channel":
        await this.handleChannelCommand(interaction);
        break;
      case "check":
        await interaction.deferReply({ ephemeral: true });
        await this.matchTracker.checkNow();
        await interaction.editReply("Verification FACEIT terminee.");
        break;
      case "test":
        await interaction.deferReply({ ephemeral: true });
        await this.matchTracker.sendTestNotification();
        await interaction.editReply("Notification de test envoyee.");
        break;
      default:
        await interaction.reply({
          content: "Sous-commande inconnue.",
          ephemeral: true
        });
    }
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

  buildLeaderboardMessage() {
    const summary = buildDashboardSummary(this.store.getState(), this.store.getStorageInfo());
    if (!summary.leaderboard.length) {
      return "Le classement apparaitra des que des matchs auront ete archives.";
    }

    return [
      "Classement FACEIT tracker :",
      ...summary.leaderboard.map(
        (entry, index) =>
          `#${index + 1} ${entry.nickname} - impact ${entry.metrics.impactScore} - ${entry.metrics.winRate}% WR - ${entry.metrics.averageKd} K/D`
      )
    ].join("\n");
  }

  async handleAddCommand(interaction) {
    const nickname = interaction.options.getString("nickname", true).trim();
    await interaction.deferReply({ ephemeral: true });
    const player = await this.matchTracker.addPlayer(nickname);
    await interaction.editReply(
      `Suivi active pour **${player.nickname}**. ${player.backfilledMatches} ancien(s) match(s) ont ete importes dans l'historique.`
    );
  }

  async handleRemoveCommand(interaction) {
    const nickname = interaction.options.getString("nickname", true).trim();
    const result = await this.store.removeTrackedPlayerByNickname(nickname);

    if (!result.removed) {
      await interaction.reply({
        content: `Aucun joueur suivi ne correspond a **${nickname}**.`,
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `Suivi supprime pour **${result.removed.nickname}**.`,
      ephemeral: true
    });
  }

  async handleChannelCommand(interaction) {
    await this.store.updateSettings({
      discordChannelId: interaction.channelId
    });

    await interaction.reply({
      content: `Les notifications seront envoyees dans <#${interaction.channelId}>.`,
      ephemeral: true
    });
  }
}

function buildFaceitCommand() {
  return new SlashCommandBuilder()
    .setName("faceit")
    .setDescription("Pilote le tracker FACEIT")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("help")
        .setDescription("Affiche l'aide du tracker FACEIT")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Affiche l'etat du bot et du suivi")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("players")
        .setDescription("Liste les joueurs suivis")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setDescription("Affiche le classement des joueurs suivis")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Ajoute un joueur FACEIT au suivi")
        .addStringOption((option) =>
          option
            .setName("nickname")
            .setDescription("Pseudo FACEIT")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Retire un joueur FACEIT du suivi")
        .addStringOption((option) =>
          option
            .setName("nickname")
            .setDescription("Pseudo FACEIT")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("channel")
        .setDescription("Utilise le salon courant pour les notifications")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("check")
        .setDescription("Force une verification immediate")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("test")
        .setDescription("Envoie une notification de test")
    );
}

function buildHelpMessage() {
  return [
    "Commandes disponibles via /faceit :",
    "/faceit help",
    "/faceit status",
    "/faceit players",
    "/faceit leaderboard",
    "/faceit add nickname:<pseudo>",
    "/faceit remove nickname:<pseudo>",
    "/faceit channel",
    "/faceit check",
    "/faceit test"
  ].join("\n");
}
