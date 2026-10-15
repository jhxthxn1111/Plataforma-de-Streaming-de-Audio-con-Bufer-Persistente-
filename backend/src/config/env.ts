import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa backend/.env (ver .env.example).`);
  }
  return value;
}

function secret(name: string): string {
  const value = required(name);
  if (value.length < 32) {
    throw new Error(`${name} debe tener al menos 32 caracteres. Genera una con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const sameSite = process.env.COOKIE_SAMESITE ?? 'strict';
if (sameSite !== 'strict' && sameSite !== 'lax' && sameSite !== 'none') {
  throw new Error('COOKIE_SAMESITE debe ser strict, lax o none.');
}
const cookieSecure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : nodeEnv === 'production';
if (sameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SAMESITE=none exige COOKIE_SECURE=true.');
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 3000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  accessTokenSecret: secret('JWT_ACCESS_SECRET'),
  accessTokenTtlSec: Number(process.env.ACCESS_TOKEN_TTL_SEC ?? 900), // 15 min
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  cookieSecure,
  cookieSameSite: sameSite,
} as const;
