import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { buildAdminCommands } from './commands/adminCommands.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error('DISCORD_TOKEN, CLIENT_ID e GUILD_ID devem estar definidos.');
}

const rest = new REST({ version: '10' }).setToken(token);

await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
  body: buildAdminCommands(),
});

console.log(`Comandos guild registrados com sucesso na guild ${guildId}.`);