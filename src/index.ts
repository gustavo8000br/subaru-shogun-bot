import 'dotenv/config';
import { SubaruShogunBot } from './bot.js';

const bot = new SubaruShogunBot();

bot.login().catch((error) => {
  console.error('Falha ao iniciar o bot:', error);
  process.exit(1);
});
