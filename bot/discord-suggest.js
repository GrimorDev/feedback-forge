import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";

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

const commandBody = [command.toJSON()];

async function registerGuildCommands(rest, targetGuildId) {
  await rest.put(Routes.applicationGuildCommands(clientId, targetGuildId), { body: commandBody });
  console.log(`Registered /suggest for guild ${targetGuildId}`);
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);

  if (guildId) {
    await registerGuildCommands(rest, guildId);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body: commandBody });
  console.log("Registered global /suggest command");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Discord bot logged in as ${client.user?.tag}`);

  const rest = new REST({ version: "10" }).setToken(token);
  for (const guild of client.guilds.cache.values()) {
    await registerGuildCommands(rest, guild.id).catch((error) => {
      console.error(`Could not register /suggest for guild ${guild.id}`, error);
    });
  }
});

client.on("guildCreate", async (guild) => {
  const rest = new REST({ version: "10" }).setToken(token);
  await registerGuildCommands(rest, guild.id).catch((error) => {
    console.error(`Could not register /suggest for new guild ${guild.id}`, error);
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "suggest") return;

  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString("tytul", true);
  const description = interaction.options.getString("opis", true);

  const response = await fetch(`${apiBaseUrl}/api/v1/webhooks/discord/suggest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      description,
      guildId: interaction.guildId,
      discordId: interaction.user.id,
      authorName: interaction.user.globalName ?? interaction.user.username,
      channelId: interaction.channelId
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
