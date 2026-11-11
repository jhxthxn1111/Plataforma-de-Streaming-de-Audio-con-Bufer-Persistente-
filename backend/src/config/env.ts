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

// Correo: en producción Render bloquea el SMTP del plan gratuito, así que se usa la API HTTP de Brevo.
const mailProvider = process.env.EMAIL_PROVIDER ?? (nodeEnv === 'production' ? '' : 'console');
if (mailProvider !== 'console' && mailProvider !== 'brevo' && mailProvider !== 'gmail') {
  throw new Error('EMAIL_PROVIDER debe ser "brevo" o "gmail" (producción) o "console" (desarrollo y pruebas).');
}
if (mailProvider === 'console' && nodeEnv === 'production') {
  throw new Error('En producción EMAIL_PROVIDER no puede ser "console": los correos de verificación no se enviarían.');
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 3000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  accessTokenSecret: secret('JWT_ACCESS_SECRET'),
  audioSecretKey: secret('AUDIO_SECRET_KEY'), // firma las URLs temporales de streaming
  accessTokenTtlSec: Number(process.env.ACCESS_TOKEN_TTL_SEC ?? 900), // 15 min
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  cookieSecure,
  cookieSameSite: sameSite,
  mail: {
    provider: mailProvider,
    brevoApiKey: mailProvider === 'brevo' ? required('BREVO_API_KEY') : '',
    gmailClientId: mailProvider === 'gmail' ? required('GMAIL_CLIENT_ID') : '',
    gmailClientSecret: mailProvider === 'gmail' ? required('GMAIL_CLIENT_SECRET') : '',
    gmailRefreshToken: mailProvider === 'gmail' ? required('GMAIL_REFRESH_TOKEN') : '',
    fromEmail: mailProvider !== 'console' ? required('MAIL_FROM_EMAIL') : 'no-reply@localhost',
    fromName: process.env.MAIL_FROM_NAME ?? 'Música',
  },
  emailVerifyTtlHours: 24,
  passwordResetTtlMinutes: 60,
  mailCooldownSec: Number(process.env.MAIL_COOLDOWN_SEC ?? 60), // mínimo entre dos correos del mismo tipo a una cuenta
} as const;
