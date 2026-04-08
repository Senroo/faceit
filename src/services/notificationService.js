import { EmbedBuilder } from "discord.js";

export class NotificationService {
  constructor({ discordClient, store }) {
    this.discordClient = discordClient;
    this.store = store;
  }

  isReady() {
    return Boolean(this.discordClient?.ready);
  }

  async sendMatchFinished(summary) {
    const channelId = this.store.getState().settings.discordChannelId;
    if (!channelId) {
      throw new Error("Salon Discord non configure.");
    }

    const channel = await this.discordClient.fetchTextChannel(channelId);
    if (!channel) {
      throw new Error("Impossible de recuperer le salon Discord configure.");
    }

    const embed = new EmbedBuilder()
      .setColor(summary.result === "Victoire" ? 0x22c55e : 0xef4444)
      .setAuthor({
        name: `${summary.trackedNickname} - ${summary.result}`,
        iconURL: summary.avatar || undefined,
        url: summary.faceitProfileUrl || summary.faceitMatchUrl || undefined
      })
      .setTitle(`${summary.competitionName}`)
      .setDescription(buildCompactMatchFlavor(summary))
      .addFields(
        { name: "Map", value: summary.map, inline: true },
        { name: "Score", value: summary.score, inline: true },
        { name: "Duree", value: summary.duration || "N/A", inline: true },
        { name: "ELO / Level", value: `${summary.elo ?? "?"} / ${summary.skillLevel ?? "?"}`, inline: true },
        {
          name: "KDA",
          value: `${summary.playerStats.kills}/${summary.playerStats.deaths}/${summary.playerStats.assists}`,
          inline: true
        },
        { name: "K/D", value: String(summary.playerStats.kd), inline: true },
        { name: "K/R", value: String(summary.playerStats.kr), inline: true },
        { name: "HS%", value: String(summary.playerStats.hs), inline: true },
        { name: "MVPs", value: String(summary.playerStats.mvps), inline: true }
      )
      .setTimestamp(summary.finishedAt ? new Date(summary.finishedAt) : new Date())
      .setFooter({ text: `FACEIT Tracker | Match ID ${summary.matchId}` });

    if (summary.avatar) {
      embed.setThumbnail(summary.avatar);
    }

    if (summary.faceitMatchUrl) {
      embed.setURL(summary.faceitMatchUrl);
    }

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      throw normalizeDiscordError(error);
    }
  }

  async sendTestMessage(channelId) {
    if (!channelId) {
      throw new Error("Definis un salon Discord avant d'envoyer un test.");
    }

    const channel = await this.discordClient.fetchTextChannel(channelId);
    if (!channel) {
      throw new Error("Impossible de recuperer le salon Discord configure.");
    }

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle("🎯 FACEIT Tracker online")
      .setDescription("Le bot est bien branche. Les notifs, le ranking et le trash talk analytique sont prets.")
      .setTimestamp(new Date());

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      throw normalizeDiscordError(error);
    }
  }
}

function buildCompactMatchFlavor(summary) {
  const kd = Number.parseFloat(String(summary.playerStats.kd).replace(",", "."));
  const kills = Number.parseFloat(String(summary.playerStats.kills).replace(",", "."));

  if (summary.isWin && kd >= 1.3) {
    return `Grosse perf. La lobby a surtout servi de terrain d'entrainement pour ${summary.trackedNickname}.`;
  }

  if (summary.isWin) {
    return `Victoire propre. Les points sont a la maison et le lobby repart avec un petit traumatisme.`;
  }

  if (!summary.isWin && kills >= 20) {
    return `Defaite, mais les stats racontent surtout une histoire de sac a dos tres lourd.`;
  }

  if (!summary.isWin && kd < 0.9) {
    return `Soiree compliquee. Le crosshair a pris le match avec quelques rounds de retard.`;
  }

  return `Match termine. Pas le meilleur chapitre, mais clairement pas la fin de saison.`;
}

function normalizeDiscordError(error) {
  const code = error?.code;
  const message = String(error?.message ?? "");

  if (code === 50001 || message.includes("Missing Access")) {
    return new Error("Le bot n'a pas acces a ce salon Discord.");
  }

  if (code === 50013 || message.includes("Missing Permissions")) {
    return new Error("Le bot n'a pas la permission d'envoyer des messages dans ce salon.");
  }

  if (code === 10003 || message.includes("Unknown Channel")) {
    return new Error("Le salon Discord configure est introuvable.");
  }

  return error instanceof Error
    ? error
    : new Error("Erreur Discord inconnue.");
}
