import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { AddTrackInput, CreatePlaylistInput, RenamePlaylistInput } from '../schemas/playlist.schemas';
import { playlistIdSchema, trackKeySchema } from '../schemas/playlist.schemas';
import * as playlistService from '../services/playlist.service';

function currentUserId(req: Request): string {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  return req.auth.userId;
}

/** Un id que no es UUID se trata como "no existe" (así no llega a la base de datos). */
function playlistId(req: Request): string {
  const parsed = playlistIdSchema.safeParse(req.params.id);
  if (!parsed.success) throw new AppError(404, 'playlist_not_found', 'La playlist no existe.');
  return parsed.data;
}

export async function list(req: Request, res: Response): Promise<void> {
  res.json({ items: await playlistService.list(currentUserId(req)) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { name } = req.body as CreatePlaylistInput;
  res.status(201).json(await playlistService.create(currentUserId(req), name));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await playlistService.get(currentUserId(req), playlistId(req)));
}

export async function rename(req: Request, res: Response): Promise<void> {
  const { name } = req.body as RenamePlaylistInput;
  res.json(await playlistService.rename(currentUserId(req), playlistId(req), name));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await playlistService.remove(currentUserId(req), playlistId(req));
  res.status(204).end();
}

export async function addTrack(req: Request, res: Response): Promise<void> {
  const { trackKey } = req.body as AddTrackInput;
  res.json(await playlistService.addTrack(currentUserId(req), playlistId(req), trackKey));
}

export async function removeTrack(req: Request, res: Response): Promise<void> {
  const key = trackKeySchema.safeParse(req.params.trackKey);
  if (!key.success) throw new AppError(404, 'playlist_track_not_found', 'Esa canción no está en la playlist.');
  await playlistService.removeTrack(currentUserId(req), playlistId(req), key.data);
  res.status(204).end();
}
