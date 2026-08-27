import { chmod, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { parse } from 'dotenv';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Uso: node scripts/bootstrap-compose-env.mjs <arquivo-temporario>');
}

const envPath = process.env.COMPOSE_SOURCE_ENV ?? '.env';
const fileValues = parse(await readFile(envPath));
const values = { ...fileValues, ...process.env };

let databaseUrl;
try {
  databaseUrl = new URL(values.DATABASE_URL);
} catch {
  throw new Error('DATABASE_URL ausente ou inválida; não foi possível preparar o ambiente do Compose');
}

if (databaseUrl.protocol !== 'postgresql:' || databaseUrl.hostname !== 'db') {
  throw new Error('DATABASE_URL deve usar PostgreSQL no host interno db');
}

const composeValues = {
  POSTGRES_DB: values.POSTGRES_DB || databaseUrl.pathname.slice(1),
  POSTGRES_USER: values.POSTGRES_USER || decodeURIComponent(databaseUrl.username),
  POSTGRES_PASSWORD: values.POSTGRES_PASSWORD || decodeURIComponent(databaseUrl.password),
};

if (Object.values(composeValues).some((value) => !value)) {
  throw new Error('DATABASE_URL não contém os dados necessários para preparar o ambiente do Compose');
}

const escapeEnvValue = (value) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;
const content = Object.entries(composeValues)
  .map(([key, value]) => `${key}=${escapeEnvValue(value)}`)
  .join('\n') + '\n';

await writeFile(outputPath, content, { encoding: 'utf8', mode: 0o600 });
try {
  await chmod(outputPath, 0o600);
} catch {
  // Windows may not expose POSIX permissions; the temporary file is still removed on exit.
}