import { closePool, pool } from './pool';
import { runMigrations } from './migrate';

async function main(): Promise<void> {
  const applied = await runMigrations(pool);
  if (applied.length === 0) console.log('Base de datos al día: no hay migraciones pendientes.');
  else applied.forEach((name) => console.log(`Migración aplicada: ${name}`));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
