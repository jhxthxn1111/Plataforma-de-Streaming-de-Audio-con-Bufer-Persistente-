import { z } from 'zod';
import { http } from './http';

export const playlistSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  trackCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlaylistSummary = z.infer<typeof playlistSummarySchema>;

export const playlistTrackSchema = z.object({ trackKey: z.string(), addedAt: z.string() });
export type PlaylistTrack = z.infer<typeof playlistTrackSchema>;

export const playlistDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tracks: z.array(playlistTrackSchema),
});
export type PlaylistDetail = z.infer<typeof playlistDetailSchema>;

const playlistListSchema = z.object({ items: z.array(playlistSummarySchema) });

export async function listPlaylists(): Promise<PlaylistSummary[]> {
  const { data } = await http.get<unknown>('/playlists');
  return playlistListSchema.parse(data).items;
}

export async function getPlaylist(id: string): Promise<PlaylistDetail> {
  const { data } = await http.get<unknown>(`/playlists/${id}`);
  return playlistDetailSchema.parse(data);
}

export async function createPlaylist(name: string): Promise<PlaylistSummary> {
  const { data } = await http.post<unknown>('/playlists', { name });
  return playlistSummarySchema.parse(data);
}

export async function renamePlaylist(id: string, name: string): Promise<PlaylistDetail> {
  const { data } = await http.patch<unknown>(`/playlists/${id}`, { name });
  return playlistDetailSchema.parse(data);
}

export async function deletePlaylist(id: string): Promise<void> {
  await http.delete(`/playlists/${id}`);
}

export async function addTrackToPlaylist(id: string, trackKey: string): Promise<PlaylistDetail> {
  const { data } = await http.post<unknown>(`/playlists/${id}/tracks`, { trackKey });
  return playlistDetailSchema.parse(data);
}

export async function removeTrackFromPlaylist(id: string, trackKey: string): Promise<void> {
  await http.delete(`/playlists/${id}/tracks/${encodeURIComponent(trackKey)}`);
}
