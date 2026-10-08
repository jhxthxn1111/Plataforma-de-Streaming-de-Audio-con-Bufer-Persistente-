import {
  genreListSchema,
  streamUrlSchema,
  trackPageSchema,
  type StreamUrl,
  type TrackPage,
} from './contracts';
import { http } from './http';

export interface TrackQuery {
  q?: string;
  genre?: string;
  page: number;
  pageSize: number;
}

export async function listTracks(query: TrackQuery, signal?: AbortSignal): Promise<TrackPage> {
  const { data } = await http.get<unknown>('/tracks', { params: query, signal });
  return trackPageSchema.parse(data);
}

export async function listGenres(): Promise<string[]> {
  const { data } = await http.get<unknown>('/tracks/genres');
  return genreListSchema.parse(data);
}

export async function getStreamUrl(trackId: string): Promise<StreamUrl> {
  const { data } = await http.get<unknown>(`/tracks/${encodeURIComponent(trackId)}/stream-url`);
  return streamUrlSchema.parse(data);
}
