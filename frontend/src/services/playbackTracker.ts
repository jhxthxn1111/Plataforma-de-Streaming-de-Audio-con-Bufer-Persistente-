import type { PlaybackEvent, PlaybackEventType } from '@/api/contracts';

/**
 * Convierte lo que hace el elemento <audio> en eventos de consumo.
 *
 * Reglas:
 *  - `listenedSec` de cada evento es el tiempo realmente escuchado desde el evento anterior (un delta),
 *    medido con el avance del reproductor. Saltar a otra parte de la canción no suma tiempo.
 *  - Un "play" cuenta cuando empieza una canción, no cuando se reanuda tras una pausa.
 *  - Los eventos se acumulan en una cola y se envían en lotes. Si no hay red se guardan en localStorage,
 *    separados por usuario, y se envían cuando vuelva la conexión (la app funciona sin conexión).
 *  - Cada lote sale de la cola antes de enviarse: si la página muere a mitad de envío se prefiere perder
 *    un lote a contarlo dos veces.
 */

export interface TrackedTrack {
  /** Clave estable de la canción: su nombre de archivo. */
  key: string;
  title: string;
  artist: string;
}

export interface SendOptions {
  keepalive?: boolean;
}
export type EventSender = (events: PlaybackEvent[], options?: SendOptions) => Promise<void>;
export type QueueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Cada cuántos segundos escuchados se emite un evento "progress" mientras suena. */
export const PROGRESS_EVERY_SEC = 15;
/** Un avance mayor entre dos "timeupdate" es un salto, no escucha. */
export const MAX_TICK_SEC = 3;
/** Máximo de eventos por petición que acepta el servidor. */
export const MAX_BATCH = 100;
/** Tope de la cola pendiente: si se llena se descartan los más antiguos. */
export const MAX_QUEUE = 500;
const STORAGE_PREFIX = 'musica.playback.queue.v1.';
const EVENT_TYPES: ReadonlySet<string> = new Set(['play', 'pause', 'progress', 'seek', 'complete']);

interface Session {
  track: TrackedTrack;
  lastPos: number;
  pending: number;
  playing: boolean;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

function isStoredEvent(value: unknown): value is PlaybackEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.trackId === 'string' &&
    typeof v.type === 'string' &&
    EVENT_TYPES.has(v.type) &&
    typeof v.positionSec === 'number' &&
    typeof v.listenedSec === 'number' &&
    typeof v.occurredAt === 'string'
  );
}

function defaultStorage(): QueueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class PlaybackTracker {
  private readonly send: EventSender;
  private readonly storage: QueueStorage | null;
  private readonly intervalMs: number;
  private owner: string | null = null;
  private session: Session | null = null;
  private queue: PlaybackEvent[] = [];
  private sending = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(send: EventSender, storage: QueueStorage | null = defaultStorage(), intervalMs = 15_000) {
    this.send = send;
    this.storage = storage;
    this.intervalMs = intervalMs;
  }

  /** Eventos esperando a ser enviados (copia de solo lectura). */
  get queued(): readonly PlaybackEvent[] {
    return [...this.queue];
  }

  /** Define de quién es la escucha. Sin usuario no se registra nada. Al cambiar de usuario se recupera su cola guardada. */
  setOwner(userId: string | null): void {
    if (userId === this.owner) return;
    this.persist();
    this.session = null;
    this.owner = userId;
    this.queue = userId ? this.load(userId) : [];
  }

  /** Envía lo pendiente cada cierto tiempo y cuando vuelve la conexión. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.intervalMs);
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
  }

  private readonly onOnline = (): void => {
    void this.flush();
  };

  /** El audio empezó a sonar (evento "playing" del <audio>). */
  onPlay(track: TrackedTrack, position: number): void {
    if (!this.owner) return;
    const current = this.session;
    if (current && current.track.key !== track.key) {
      // Cambió de canción sin que llegara el "pause" de la anterior: se cierra aquí.
      if (current.playing) this.emit('pause', current, current.lastPos, current.pending);
      this.session = null;
    }
    if (!this.session) {
      this.session = { track, lastPos: position, pending: 0, playing: true };
      this.emit('play', this.session, position, 0);
      return;
    }
    this.session.lastPos = position;
    this.session.playing = true;
  }

  onTimeUpdate(position: number): void {
    const s = this.session;
    if (!s || !s.playing) return;
    this.capture(s, position);
    if (s.pending >= PROGRESS_EVERY_SEC) {
      this.emit('progress', s, position, s.pending);
      s.pending = 0;
    }
  }

  onPause(position: number): void {
    const s = this.session;
    if (!s || !s.playing) return;
    this.capture(s, position);
    s.playing = false;
    this.emit('pause', s, position, s.pending);
    s.pending = 0;
  }

  onSeeked(position: number): void {
    const s = this.session;
    if (!s) return;
    this.emit('seek', s, position, s.pending);
    s.pending = 0;
    s.lastPos = position;
  }

  /** La canción terminó. El navegador dispara "pause" justo antes, así que normalmente no queda nada pendiente. */
  onEnded(position: number): void {
    const s = this.session;
    if (!s) return;
    this.capture(s, position);
    this.emit('complete', s, position, s.pending);
    this.session = null;
  }

  /** Cierra la sesión actual (por ejemplo al cerrar la sesión de usuario) y envía lo pendiente. */
  stop(position: number): Promise<void> {
    const s = this.session;
    if (s) {
      if (s.playing) {
        this.capture(s, position);
        this.emit('pause', s, position, s.pending);
      }
      this.session = null;
    }
    return this.flush();
  }

  /** La pestaña se oculta o se cierra: registra lo escuchado hasta ahora (sin cerrar la sesión) y lo envía. */
  checkpoint(position: number): Promise<void> {
    const s = this.session;
    if (s && s.playing) {
      this.capture(s, position);
      if (s.pending > 0) {
        this.emit('progress', s, position, s.pending);
        s.pending = 0;
      }
    }
    return this.flush({ keepalive: true });
  }

  /** Envía la cola en lotes. Si un lote falla, vuelve al inicio de la cola para el próximo intento. */
  async flush(options?: SendOptions): Promise<void> {
    if (this.sending || !this.owner) return;
    this.sending = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, MAX_BATCH);
        this.persist();
        try {
          await this.send(batch, options);
        } catch {
          this.queue = [...batch, ...this.queue].slice(-MAX_QUEUE);
          this.persist();
          return;
        }
      }
    } finally {
      this.sending = false;
    }
  }

  /** Suma el avance desde la última lectura, solo si fue una reproducción normal. */
  private capture(s: Session, position: number): void {
    const delta = position - s.lastPos;
    if (s.playing && delta > 0 && delta <= MAX_TICK_SEC) s.pending += delta;
    s.lastPos = position;
  }

  private emit(type: PlaybackEventType, s: Session, position: number, listened: number): void {
    this.queue.push({
      trackId: s.track.key,
      trackTitle: s.track.title,
      trackArtist: s.track.artist,
      type,
      positionSec: round1(Math.max(position, 0)),
      listenedSec: round1(Math.max(listened, 0)),
      occurredAt: new Date().toISOString(),
    });
    if (this.queue.length > MAX_QUEUE) this.queue = this.queue.slice(-MAX_QUEUE);
    this.persist();
  }

  private persist(): void {
    if (!this.storage || !this.owner) return;
    try {
      const key = STORAGE_PREFIX + this.owner;
      if (this.queue.length === 0) this.storage.removeItem(key);
      else this.storage.setItem(key, JSON.stringify(this.queue));
    } catch {
      // Sin espacio o almacenamiento bloqueado: la cola sigue en memoria.
    }
  }

  private load(userId: string): PlaybackEvent[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(STORAGE_PREFIX + userId);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isStoredEvent).slice(-MAX_QUEUE) : [];
    } catch {
      return [];
    }
  }
}
