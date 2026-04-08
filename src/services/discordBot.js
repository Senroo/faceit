import {
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  SlashCommandBuilder
} from "discord.js";
import { buildDashboardSummary } from "./performanceSummary.js";

export class DiscordBot {
  constructor({ token, guildId, store, matchTracker, openRouterService }) {
    this.token = token;
    this.guildId = guildId;
    this.store = store;
    this.matchTracker = matchTracker;
    this.openRouterService = openRouterService;
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
          embeds: [buildHelpEmbed()],
          ephemeral: true
        });
        break;
      case "status":
        await interaction.reply({
          embeds: [this.buildStatusEmbed()],
          ephemeral: true
        });
        break;
      case "players":
        await interaction.reply({
          embeds: [this.buildPlayersEmbed()],
          ephemeral: true
        });
        break;
      case "leaderboard":
        await interaction.reply({
          embeds: [this.buildLeaderboardEmbed()],
          ephemeral: false
        });
        break;
      case "analyze":
        await this.handleAnalyzeCommand(interaction);
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
        await interaction.editReply({
          embeds: [buildSimpleEmbed("Radar sweep termine", "Le tracker a rescane FACEIT. Si un match trainait, il est maintenant pris en compte.", 0x48a8ff)]
        });
        break;
      case "test":
        await interaction.deferReply({ ephemeral: true });
        await this.matchTracker.sendTestNotification();
        await interaction.editReply({
          embeds: [buildSimpleEmbed("Ping check valide", "Notification de test envoyee dans ton salon de tracking.", 0x4de2d4)]
        });
        break;
      default:
        await interaction.reply({
          content: "Sous-commande inconnue.",
          ephemeral: true
        });
    }
  }

  buildStatusEmbed() {
    const state = this.store.getState();
    const runtime = state.runtime;

    return new EmbedBuilder()
      .setColor(0x48a8ff)
      .setTitle("Control Room - Etat du bot")
      .setDescription("Le radar du tracker te donne l'etat live du service, du salon notif et du dernier sweep FACEIT.")
      .addFields(
        { name: "Joueurs suivis", value: String(state.trackedPlayers.length), inline: true },
        { name: "Salon notif", value: state.settings.discordChannelId || "non configure", inline: true },
        { name: "Intervalle", value: `${state.settings.pollIntervalSeconds}s`, inline: true },
        { name: "Dernier check", value: runtime.lastSuccessfulPollAt || "jamais", inline: false },
        { name: "Derniere erreur", value: runtime.lastError || "aucune", inline: false }
      );
  }

  buildPlayersEmbed() {
    const players = this.store.getState().trackedPlayers;
    if (!players.length) {
      return buildSimpleEmbed(
        "Roster vide",
        "Ajoute un joueur avec `/faceit add nickname:<pseudo>` pour lancer le suivi et le backfill historique.",
        0x48a8ff
      );
    }

    return new EmbedBuilder()
      .setColor(0x4de2d4)
      .setTitle("Roster FACEIT suivi")
      .setDescription(
        players
          .map(
            (player) =>
              `• **${player.nickname}** - ${player.elo ?? "?"} ELO - lvl ${player.skillLevel ?? "?"}`
          )
          .join("\n")
      );
  }

  buildLeaderboardEmbed() {
    const summary = buildDashboardSummary(this.store.getState(), this.store.getStorageInfo());
    if (!summary.leaderboard.length) {
      return buildSimpleEmbed(
        "Classement en chauffe",
        "Le leaderboard se remplit quand l'historique des matchs est importe. Lance `/faceit add` ou laisse tourner le tracker.",
        0xf59e0b
      );
    }

    const lines = summary.leaderboard.map((entry, index) => {
      const medal = medalForRank(index);
      const form = renderFormIcons(entry.metrics.recentForm);
      const kd = Number(entry.metrics.averageKd).toFixed(2);
      const winRate = Number(entry.metrics.winRate).toFixed(0);
      return `${medal} **${index + 1}. ${entry.nickname}** - ${entry.elo ?? "?"} ELO (Lvl ${entry.skillLevel ?? "?"})\n└ K/D: **${kd}** - WR: **${winRate}%** - ${form}`;
    });

    const topPlayer = summary.leaderboard[0];

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("Classement Faceit - Squad")
      .setDescription(lines.join("\n\n"))
      .setFooter({
        text: `Faceit Tracker - ${new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "short",
          timeStyle: "short"
        }).format(new Date())}`
      });

    if (topPlayer?.avatar) {
      embed.setThumbnail(topPlayer.avatar);
    }

    return embed;
  }

  async handleAnalyzeCommand(interaction) {
    const nickname = interaction.options.getString("nickname", true).trim();
    const taggedUser = interaction.options.getUser("membre");
    await interaction.deferReply({ ephemeral: false });

    const summary = buildDashboardSummary(this.store.getState(), this.store.getStorageInfo());
    const player = summary.playerCards.find(
      (entry) => entry.nickname.toLowerCase() === nickname.toLowerCase()
    );

    if (!player) {
      await interaction.editReply({
        embeds: [
          buildSimpleEmbed(
            "Profil introuvable",
            "Ce joueur n'est pas encore dans ton tracker. Ajoute-le d'abord avec `/faceit add`.",
            0xef4444
          )
        ]
      });
      return;
    }

    if (player.metrics.matches === 0) {
      await interaction.editReply({
        embeds: [
          buildSimpleEmbed(
            "Pas assez de data",
            "Le joueur est bien suivi, mais il n'a pas encore d'historique exploitable. Laisse le backfill tourner ou relance l'ajout.",
            0xf59e0b
          )
        ]
      });
      return;
    }

    if (!this.openRouterService?.isConfigured()) {
      await interaction.editReply({
        embeds: [
          buildSimpleEmbed(
            "IA non branchee",
            "Ajoute `OPENROUTER_API_KEY` dans Railway pour debloquer l'analyse humouristique du profil.",
            0xef4444
          )
        ]
      });
      return;
    }

    const recentMatches = summary.recentMatches.filter(
      (match) => match.trackedNickname.toLowerCase() === player.nickname.toLowerCase()
    );
    const mentionLabel = taggedUser ? `<@${taggedUser.id}>` : `**${player.nickname}**`;
    const analysis = await this.openRouterService.analyzePlayerProfile({
      player,
      summary: player,
      recentMatches,
      taggedUserLabel: mentionLabel
    });

    const intro = buildAnalysisIntro(player);
    const embed = new EmbedBuilder()
      .setColor(0xa78bfa)
      .setTitle(`Scan Gemma - ${player.nickname}`)
      .setDescription(`${mentionLabel}, ton profil est passe au rayon X.\n\n${intro}\n\n${analysis}`)
      .addFields(
        { name: "ELO / Level", value: `${player.elo ?? "?"} / ${player.skillLevel ?? "?"}`, inline: true },
        { name: "K/D moyen", value: String(player.metrics.averageKd), inline: true },
        { name: "Win rate", value: `${player.metrics.winRate}%`, inline: true }
      );

    if (player.avatar) {
      embed.setThumbnail(player.avatar);
    }

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: taggedUser ? { users: [taggedUser.id] } : undefined
    });
  }

  async handleAddCommand(interaction) {
    const nickname = interaction.options.getString("nickname", true).trim();
    await interaction.deferReply({ ephemeral: true });
    const player = await this.matchTracker.addPlayer(nickname);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x4de2d4)
          .setTitle(`Nouveau lock sur ${player.nickname}`)
          .setDescription(
            `Le tracker a branché les capteurs sur **${player.nickname}**.\nBackfill historique importe: **${player.backfilledMatches}** match(s).`
          )
          .addFields(
            { name: "ELO", value: String(player.elo ?? "?"), inline: true },
            { name: "Level", value: String(player.skillLevel ?? "?"), inline: true },
            { name: "Jeu", value: player.gameId ?? "cs2", inline: true }
          )
      ]
    });
  }

  async handleRemoveCommand(interaction) {
    const nickname = interaction.options.getString("nickname", true).trim();
    const result = await this.store.removeTrackedPlayerByNickname(nickname);

    if (!result.removed) {
      await interaction.reply({
        embeds: [
          buildSimpleEmbed(
            "Cible introuvable",
            `Aucun joueur suivi ne correspond a **${nickname}**.`,
            0xef4444
          )
        ],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [
        buildSimpleEmbed(
          "Cible retiree",
          `Le suivi de **${result.removed.nickname}** a ete coupe proprement.`,
          0xef4444
        )
      ],
      ephemeral: true
    });
  }

  async handleChannelCommand(interaction) {
    await this.store.updateSettings({
      discordChannelId: interaction.channelId
    });

    await interaction.reply({
      embeds: [
        buildSimpleEmbed(
          "Salon verrouille",
          `Les notifications partiront maintenant dans <#${interaction.channelId}>.`,
          0x48a8ff
        )
      ],
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
        .setDescription("Affiche le classement stylise des joueurs suivis")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("analyze")
        .setDescription("Analyse humouristique d'un profil FACEIT")
        .addStringOption((option) =>
          option
            .setName("nickname")
            .setDescription("Pseudo FACEIT")
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("membre")
            .setDescription("Membre Discord a mentionner dans l'analyse")
            .setRequired(false)
        )
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

function buildHelpEmbed() {
  return new EmbedBuilder()
    .setColor(0x48a8ff)
    .setTitle("Slash pack FACEIT")
    .setDescription(
      [
        "`/faceit add nickname:<pseudo>`",
        "`/faceit leaderboard`",
        "`/faceit analyze nickname:<pseudo> membre:@joueur`",
        "`/faceit players`",
        "`/faceit status`",
        "`/faceit channel`",
        "`/faceit check`",
        "`/faceit test`"
      ].join("\n")
    );
}

function buildSimpleEmbed(title, description, color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description);
}

function renderFormIcons(recentForm) {
  const padded = [...(recentForm ?? [])];
  while (padded.length < 5) {
    padded.unshift("-");
  }

  return padded
    .map((entry) => {
      if (entry === "W") {
        return "✅";
      }

      if (entry === "L") {
        return "❌";
      }

      return "➖";
    })
    .join("");
}

function medalForRank(index) {
  if (index === 0) {
    return "🥇";
  }

  if (index === 1) {
    return "🥈";
  }

  if (index === 2) {
    return "🥉";
  }

  return `${index + 1}.`;
}

function buildAnalysisIntro(player) {
  const kd = Number(player.metrics.averageKd);
  const wr = Number(player.metrics.winRate);

  if (kd >= 1.15 && wr >= 52) {
    return "Verdict express: tu sens le joueur qui ouvre les rounds comme si le serveur lui devait de l'argent.";
  }

  if (kd < 1 && wr < 45) {
    return "Verdict express: ton profil a de l'energie, mais pour l'instant il distribue surtout des cadeaux aux adversaires.";
  }

  return "Verdict express: profil interessant, des vraies qualites, mais encore quelques reglages a faire avant de faire trembler la lobby.";
}
