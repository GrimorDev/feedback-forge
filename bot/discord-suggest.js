import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
const projectSlug = process.env.PROJECT_SLUG ?? "orbit-chat";

if (!token || !clientId) {
  throw new Error("DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required");
}

const command = new SlashCommandBuilder()
  .setName("suggest")
  .setDescription("Wyślij sugestię do roadmapy")
  .addStringOption((option) =>
    option.setName("tytul").setDescription("Krótki tytuł sugestii").setMinLength(5).setMaxLength(180).setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("opis").setDescription("Opis problemu lub pomysłu").setMinLength(10).setMaxLength(5000).setRequired(true)
  );

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  const body = [command.toJSON()];

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`Registered /suggest for guild ${guildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log("Registered global /suggest command");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Discord bot logged in as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "suggest") return;

  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString("tytul", true);
  const description = interaction.options.getString("opis", true);

  const response = await fetch(`${apiBaseUrl}/api/v1/projects/${projectSlug}/feedbacks/discord`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      description,
      discord_user_id: interaction.user.id,
      discord_username: interaction.user.globalName ?? interaction.user.username,
      channel_id: interaction.channelId
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    await interaction.editReply(`Nie udało się dodać sugestii: ${error.error ?? response.statusText}`);
    return;
  }

  await interaction.editReply("Sugestia trafiła do triage. Dzięki!");
});

await registerCommands();
await client.login(token);
