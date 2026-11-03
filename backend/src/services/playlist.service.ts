import { isUniqueViolation } from '../db/errors';
import { AppError } from '../errors/AppError';
import * as playlistModel from '../models/playlist.model';
import type { PlaylistDetailRecord, PlaylistRecord } from '../models/playlist.model';

const notFound = (): AppError => new AppError(404, 'playlist_not_found', 'La playlist no existe.');
const nameTaken = (): AppError => new AppError(409, 'playlist_name_taken', 'Ya tienes una playlist con ese nombre.');

export function list(userId: string): Promise<PlaylistRecord[]> {
  return playlistModel.listByUser(userId);
}

export async function get(userId: string, id: string): Promise<PlaylistDetailRecord> {
  const playlist = await playlistModel.findOwned(id, userId);
  if (!playlist) throw notFound();
  return playlist;
}

export async function create(userId: string, name: string): Promise<PlaylistRecord> {
  try {
    return await playlistModel.create(userId, name);
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
}

export async function rename(userId: string, id: string, name: string): Promise<PlaylistDetailRecord> {
  try {
    if (!(await playlistModel.rename(id, userId, name))) throw notFound();
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
  return get(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  if (!(await playlistModel.remove(id, userId))) throw notFound();
}

export async function addTrack(userId: string, id: string, trackKey: string): Promise<PlaylistDetailRecord> {
  const result = await playlistModel.addTrack(id, userId, trackKey);
  if (result === 'not_found') throw notFound();
  if (result === 'full') {
    throw new AppError(409, 'playlist_full', `Una playlist admite hasta ${playlistModel.MAX_TRACKS_PER_PLAYLIST} canciones.`);
  }
  return get(userId, id);
}

export async function removeTrack(userId: string, id: string, trackKey: string): Promise<void> {
  if (!(await playlistModel.removeTrack(id, userId, trackKey))) {
    throw new AppError(404, 'playlist_track_not_found', 'Esa canción no está en la playlist.');
  }
}
