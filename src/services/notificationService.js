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
      .setTitle(`FACEIT - ${summary.trackedNickname}`)
      .setDescription(`${summary.result} sur ${summary.map}`)
      .addFields(
        { name: "Competition", value: summary.competitionName, inline: false },
        { name: "Score", value: summary.score, inline: true },
        { name: "Mode", value: summary.gameMode, inline: true },
        {
          name: "K / D / A",
          value: `${summary.playerStats.kills} / ${summary.playerStats.deaths} / ${summary.playerStats.assists}`,
          inline: true
        },
        { name: "K/D", value: String(summary.playerStats.kd), inline: true },
        { name: "K/R", value: String(summary.playerStats.kr), inline: true },
        { name: "HS%", value: String(summary.playerStats.hs), inline: true }
      )
      .setTimestamp(summary.finishedAt ? new Date(summary.finishedAt) : new Date())
      .setFooter({ text: `Match ID: ${summary.matchId}` });

    if (summary.faceitMatchUrl) {
      embed.setURL(summary.faceitMatchUrl);
    }

    await channel.send({ embeds: [embed] });
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
      .setTitle("FACEIT Tracker")
      .setDescription("Le bot est connecte et les notifications de fin de match sont actives.")
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  }
}
