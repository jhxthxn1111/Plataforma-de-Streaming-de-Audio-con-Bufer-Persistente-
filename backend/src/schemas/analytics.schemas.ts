import { z } from 'zod';

/** Acepta nombres IANA ("America/Bogota", "UTC"). Se rechazan desfases como "+05:00": PostgreSQL los interpreta al revés. */
const IANA_SHAPE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/;

function isValidTimeZone(value: string): boolean {
  if (!IANA_SHAPE.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const summaryQuerySchema = z.object({
  days: z.coerce
    .number({ invalid_type_error: 'days debe ser un número' })
    .int('days debe ser un entero')
    .min(1, 'days mínimo es 1')
    .max(30, 'days máximo es 30')
    .default(7),
  tz: z.string().max(64).refine(isValidTimeZone, 'Zona horaria no válida').default('UTC'),
});
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
