import { z } from 'zod';

const playlistName = z.string().trim().min(1, 'Escribe un nombre para la playlist').max(80, 'Máximo 80 caracteres');

export const createPlaylistSchema = z.object({ name: playlistName });
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;

export const renamePlaylistSchema = z.object({ name: playlistName });
export type RenamePlaylistInput = z.infer<typeof renamePlaylistSchema>;

/** La clave de una canción es su nombre de archivo del catálogo: nunca una ruta. */
export const trackKeySchema = z
  .string()
  .min(1, 'Falta la canción')
  .max(200)
  .regex(/^[^/\\]+\.mp3$/i, 'Canción inválida');

export const addTrackSchema = z.object({ trackKey: trackKeySchema });
export type AddTrackInput = z.infer<typeof addTrackSchema>;

export const playlistIdSchema = z.string().uuid();
