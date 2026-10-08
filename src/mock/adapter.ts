import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import {
  loginRequestSchema,
  playbackEventBatchSchema,
  type AnalyticsSummary,
  type Role,
  type Track,
} from '@/api/contracts';
import { newId } from '@/utils/id';
import { MOCK_TRACKS } from './data';

/**
 * Backend simulado: reproduce el contrato REST real (auth con doble token,
 * catálogo paginado, URL firmada de streaming, analítica) para poder
 * desarrollar y probar el frontend sin servidor.
 */

interface MockUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  password: string;
}

interface MockResult {
  status: number;
  data: unknown;
}

const SESSION_KEY = 'cauce.mock.session'; // simula la cookie HttpOnly del refresh token
const TOKEN_TTL_MS = 90_000;

const USERS: MockUser[] = [
  { id: 'u1', email: 'demo@cauce.app', displayName: 'Demo', role: 'listener', password: 'Demo1234!' },
  { id: 'u2', email: 'admin@cauce.app', displayName: 'Administración', role: 'admin', password: 'Admin1234!' },
];

const validTokens = new Map<string, { userId: string; expiresAt: number }>();

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTrack(seed: (typeof MOCK_TRACKS)[number]): Track {
  return {
    id: seed.id,
    title: seed.title,
    artist: seed.artist,
    album: seed.album,
    genre: seed.genre,
    durationSec: seed.durationSec,
    bitrateKbps: seed.bitrateKbps,
    sizeBytes: Math.round(seed.durationSec * seed.bitrateKbps * 125),
    hue: seed.hue,
  };
}

// --- Historial sembrado para que la analítica no arranque vacía ---
const dailyListened = new Map<string, number>();
const trackStats = new Map<string, { plays: number; completes: number; listenedSec: number }>();

(function seedHistory() {
  const today = new Date();
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const seconds = Math.round(1200 + 900 * Math.sin(i * 1.3) + (i % 3) * 400);
    dailyListened.set(toDateKey(day), Math.max(seconds, 300));
  }
  MOCK_TRACKS.forEach((track, index) => {
    const plays = 3 + ((index * 7) % 11);
    trackStats.set(track.id, {
      plays,
      completes: Math.max(plays - 2 - (index % 3), 0),
      listenedSec: plays * Math.round(track.durationSec * 0.8),
    });
  });
})();

function issueSession(user: MockUser): MockResult {
  const accessToken = newId();
  validTokens.set(accessToken, { userId: user.id, expiresAt: Date.now() + TOKEN_TTL_MS });
  localStorage.setItem(SESSION_KEY, user.id);
  return {
    status: 200,
    data: {
      accessToken,
      expiresIn: TOKEN_TTL_MS / 1000,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    },
  };
}

function fail(status: number, code: string, message: string): MockResult {
  return { status, data: { code, message } };
}

function authenticate(config: InternalAxiosRequestConfig): MockUser | null {
  const header = config.headers.get('Authorization');
  if (typeof header !== 'string') return null;
  const token = header.replace(/^Bearer\s+/, '');
  const entry = validTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return USERS.find((u) => u.id === entry.userId) ?? null;
}

function readParam(config: InternalAxiosRequestConfig, key: string): string | undefined {
  const params = config.params as Record<string, unknown> | undefined;
  const value = params?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function readBody(config: InternalAxiosRequestConfig): unknown {
  if (typeof config.data !== 'string' || config.data === '') return undefined;
  const parsed: unknown = JSON.parse(config.data);
  return parsed;
}

function buildSummary(days: number): AnalyticsSummary {
  const daily: AnalyticsSummary['daily'] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = toDateKey(day);
    daily.push({ date: key, listenedSec: dailyListened.get(key) ?? 0 });
  }
  let totalPlays = 0;
  let completes = 0;
  let totalListened = 0;
  const topTracks = MOCK_TRACKS.map((track) => {
    const stats = trackStats.get(track.id) ?? { plays: 0, completes: 0, listenedSec: 0 };
    totalPlays += stats.plays;
    completes += stats.completes;
    totalListened += stats.listenedSec;
    return { trackId: track.id, title: track.title, artist: track.artist, plays: stats.plays, listenedSec: stats.listenedSec };
  })
    .filter((t) => t.plays > 0)
    .sort((a, b) => b.listenedSec - a.listenedSec)
    .slice(0, 5);

  return {
    totalListenedSec: daily.reduce((sum, d) => sum + d.listenedSec, 0) || totalListened,
    totalPlays,
    completionRate: totalPlays === 0 ? 0 : Math.min(completes / totalPlays, 1),
    distinctTracks: topTracks.length,
    daily,
    topTracks,
  };
}

function route(config: InternalAxiosRequestConfig): MockResult {
  const method = (config.method ?? 'get').toLowerCase();
  const path = config.url ?? '';

  if (method === 'post' && path === '/auth/login') {
    const parsed = loginRequestSchema.safeParse(readBody(config));
    if (!parsed.success) return fail(422, 'validation_error', 'Revisa el correo y la contraseña.');
    const user = USERS.find((u) => u.email === parsed.data.email.toLowerCase() && u.password === parsed.data.password);
    if (!user) return fail(401, 'invalid_credentials', 'Correo o contraseña incorrectos.');
    return issueSession(user);
  }
  if (method === 'post' && path === '/auth/refresh') {
    const userId = localStorage.getItem(SESSION_KEY);
    const user = USERS.find((u) => u.id === userId);
    if (!user) return fail(401, 'refresh_invalid', 'La sesión expiró.');
    return issueSession(user);
  }
  if (method === 'post' && path === '/auth/logout') {
    localStorage.removeItem(SESSION_KEY);
    return { status: 204, data: null };
  }

  const user = authenticate(config);
  if (!user) return fail(401, 'unauthorized', 'Sesión no válida.');

  if (method === 'get' && path === '/tracks/genres') {
    return { status: 200, data: [...new Set(MOCK_TRACKS.map((t) => t.genre))].sort() };
  }
  if (method === 'get' && path === '/tracks') {
    const q = (readParam(config, 'q') ?? '').toLowerCase();
    const genre = readParam(config, 'genre');
    const page = Math.max(Number(readParam(config, 'page') ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(readParam(config, 'pageSize') ?? 8), 1), 50);
    const filtered = MOCK_TRACKS.filter(
      (t) =>
        (!genre || t.genre === genre) &&
        (!q || `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q)),
    );
    const items = filtered.slice((page - 1) * pageSize, page * pageSize).map(toTrack);
    return { status: 200, data: { items, total: filtered.length, page, pageSize } };
  }
  const streamMatch = /^\/tracks\/([\w-]+)\/stream-url$/.exec(path);
  if (method === 'get' && streamMatch) {
    const track = MOCK_TRACKS.find((t) => t.id === streamMatch[1]);
    if (!track) return fail(404, 'track_not_found', 'La canción no existe.');
    const expires = Date.now() + 10 * 60_000;
    return {
      status: 200,
      data: {
        url: `/mock-media/${track.id}.wav?exp=${expires}&sig=${newId()}`,
        expiresAt: new Date(expires).toISOString(),
      },
    };
  }
  if (method === 'post' && path === '/analytics/events') {
    const parsed = playbackEventBatchSchema.safeParse(readBody(config));
    if (!parsed.success) return fail(422, 'validation_error', 'Eventos con formato inválido.');
    const today = toDateKey(new Date());
    for (const event of parsed.data.events) {
      dailyListened.set(today, (dailyListened.get(today) ?? 0) + event.listenedSec);
      const stats = trackStats.get(event.trackId) ?? { plays: 0, completes: 0, listenedSec: 0 };
      stats.listenedSec += event.listenedSec;
      if (event.type === 'play') stats.plays += 1;
      if (event.type === 'complete') stats.completes += 1;
      trackStats.set(event.trackId, stats);
    }
    return { status: 202, data: { accepted: parsed.data.events.length } };
  }
  if (method === 'get' && path === '/analytics/summary') {
    const days = Math.min(Math.max(Number(readParam(config, 'days') ?? 7), 1), 30);
    return { status: 200, data: buildSummary(days) };
  }
  if (method === 'get' && path === '/admin/overview') {
    if (user.role !== 'admin') return fail(403, 'forbidden', 'Solo administración puede ver este panel.');
    const genres = new Map<string, number>();
    MOCK_TRACKS.forEach((t) => genres.set(t.genre, (genres.get(t.genre) ?? 0) + (trackStats.get(t.id)?.plays ?? 0)));
    const totalPlays = [...genres.values()].reduce((a, b) => a + b, 0) || 1;
    return {
      status: 200,
      data: {
        activeListeners: 37,
        streamedBytes: 4_812_000_000,
        totalTracks: MOCK_TRACKS.length,
        topGenres: [...genres.entries()]
          .map(([genre, plays]) => ({ genre, share: plays / totalPlays }))
          .sort((a, b) => b.share - a.share),
      },
    };
  }
  return fail(404, 'not_found', 'Ruta no encontrada.');
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const mockAdapter: AxiosAdapter = async (config) => {
  await delay(180 + Math.random() * 220);
  const result = route(config);
  const response: AxiosResponse = {
    data: result.data,
    status: result.status,
    statusText: String(result.status),
    headers: { 'x-correlation-id': String(config.headers.get('X-Correlation-Id') ?? '') },
    config,
    request: {},
  };
  if (result.status >= 200 && result.status < 300) return response;
  throw new AxiosError(
    `Request failed with status code ${result.status}`,
    result.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    response,
  );
};
