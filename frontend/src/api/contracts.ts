import { z } from 'zod';

/**
 * Contratos de la API: el esquema Zod es la única fuente de verdad.
 * Los tipos TypeScript se infieren de él, así que no hay `any` ni tipos duplicados.
 */

export const roleSchema = z.enum(['listener', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  role: roleSchema,
});
export type User = z.infer<typeof userSchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().email('Escribe un correo válido'),
  password: z.string().min(8, 'La contraseña tiene al menos 8 caracteres'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const registerRequestSchema = z.object({
  displayName: z.string().trim().min(2, 'Escribe tu nombre (mínimo 2 letras)').max(60, 'Máximo 60 caracteres'),
  email: z.string().trim().email('Escribe un correo válido'),
  password: z
    .string()
    .min(8, 'La contraseña tiene al menos 8 caracteres')
    .regex(/[A-Za-z]/, 'Incluye al menos una letra')
    .regex(/\d/, 'Incluye al menos un número'),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/** Formulario de registro: añade la confirmación, que no se envía al servidor. */
export const registerFormSchema = registerRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

export const updateProfileRequestSchema = z.object({
  displayName: registerRequestSchema.shape.displayName,
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
  newPassword: registerRequestSchema.shape.password,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

/** Formulario de cambio de contraseña: añade la confirmación, que no se envía al servidor. */
export const changePasswordFormSchema = changePasswordRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

export const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const trackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  genre: z.string(),
  durationSec: z.number().positive(),
  bitrateKbps: z.number().int().positive(),
  sizeBytes: z.number().int().nonnegative(),
  hue: z.number().min(0).max(360),
});
export type Track = z.infer<typeof trackSchema>;

export const trackPageSchema = z.object({
  items: z.array(trackSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type TrackPage = z.infer<typeof trackPageSchema>;

export const genreListSchema = z.array(z.string());

export const streamUrlSchema = z.object({
  /** URL firmada y temporal; el servidor responde con 206 Partial Content a cabeceras Range. */
  url: z.string().min(1),
  expiresAt: z.string(),
});
export type StreamUrl = z.infer<typeof streamUrlSchema>;

export const playbackEventTypeSchema = z.enum(['play', 'pause', 'progress', 'seek', 'complete']);
export type PlaybackEventType = z.infer<typeof playbackEventTypeSchema>;

export const playbackEventSchema = z.object({
  trackId: z.string(),
  trackTitle: z.string().max(200).optional(),
  trackArtist: z.string().max(200).optional(),
  type: playbackEventTypeSchema,
  positionSec: z.number().nonnegative(),
  listenedSec: z.number().nonnegative(),
  occurredAt: z.string(),
});
export type PlaybackEvent = z.infer<typeof playbackEventSchema>;

export const playbackEventBatchSchema = z.object({ events: z.array(playbackEventSchema) });

export const analyticsSummarySchema = z.object({
  totalListenedSec: z.number().nonnegative(),
  totalPlays: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(1),
  distinctTracks: z.number().int().nonnegative(),
  daily: z.array(z.object({ date: z.string(), listenedSec: z.number().nonnegative() })),
  topTracks: z.array(
    z.object({
      trackId: z.string(),
      title: z.string(),
      artist: z.string(),
      plays: z.number().int().nonnegative(),
      listenedSec: z.number().nonnegative(),
    }),
  ),
});
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

export const adminOverviewSchema = z.object({
  activeListeners: z.number().int().nonnegative(),
  streamedBytes: z.number().nonnegative(),
  totalTracks: z.number().int().nonnegative(),
  topGenres: z.array(z.object({ genre: z.string(), share: z.number().min(0).max(1) })),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
