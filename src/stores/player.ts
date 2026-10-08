import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { z } from 'zod';
import { trackSchema, type PlaybackEventType, type StreamUrl, type Track } from '@/api/contracts';
import { toAppError } from '@/api/errors';
import { getStreamUrl } from '@/api/tracks';
import { describeMediaError, getAudio, readBufferedRanges } from '@/services/audioEngine';
import type { BufferedRange, PlayerStatus, RepeatMode } from '@/types/player';
import { bufferedAhead } from '@/utils/buffer';
import { indexAfterRemoval, nextIndex, previousIndex } from '@/utils/queue';
import { useAnalyticsStore } from './analytics';

const STORAGE_PREFIX = 'cauce.player.v1.';
const PROGRESS_EVERY_SEC = 15;
const URL_REFRESH_MARGIN_MS = 30_000;

const persistedSchema = z.object({
  queue: z.array(trackSchema),
  index: z.number().int(),
  position: z.number().nonnegative(),
  volume: z.number().min(0).max(1),
  repeat: z.enum(['off', 'all', 'one']),
});

/**
 * Store del reproductor. Vive fuera de los componentes y maneja un único
 * <audio>, por eso la reproducción no se interrumpe al cambiar de vista.
 * El navegador pide el audio por rangos (cabeceras Range → 206) y el store
 * expone qué rangos ya están en el búfer.
 */
export const usePlayerStore = defineStore('player', () => {
  const analytics = useAnalyticsStore();

  const queue = ref<Track[]>([]);
  const index = ref(-1);
  const status = ref<PlayerStatus>('idle');
  const position = ref(0);
  const duration = ref(0);
  const buffered = ref<BufferedRange[]>([]);
  const volume = ref(0.8);
  const muted = ref(false);
  const repeat = ref<RepeatMode>('off');
  const error = ref<string | null>(null);
  const streamUrl = ref<StreamUrl | null>(null);

  const currentTrack = computed<Track | null>(() => queue.value[index.value] ?? null);
  const isPlaying = computed(() => status.value === 'playing' || status.value === 'buffering');
  const bufferAheadSec = computed(() => bufferedAhead(buffered.value, position.value));

  let attached = false;
  let storageKey: string | null = null;
  let loadedTrackId: string | null = null;
  let loadToken = 0;
  let pendingSeek = 0;
  let wantsPlay = false;
  let playLogged = false;
  let recoveredOnce = false;
  let lastTime = 0;
  let listenedSinceEvent = 0;
  let lastPersist = 0;

  // ---------- analítica ----------
  function emit(type: PlaybackEventType): void {
    const track = currentTrack.value;
    if (!track) return;
    analytics.record({
      trackId: track.id,
      type,
      positionSec: Math.round(position.value * 10) / 10,
      listenedSec: Math.round(listenedSinceEvent * 10) / 10,
      occurredAt: new Date().toISOString(),
    });
    listenedSinceEvent = 0;
  }

  // ---------- persistencia local (cola, posición, volumen) ----------
  function persist(): void {
    if (!storageKey) return;
    try {
      const data = {
        queue: queue.value,
        index: index.value,
        position: position.value,
        volume: volume.value,
        repeat: repeat.value,
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // Almacenamiento lleno o bloqueado: se ignora, no es crítico.
    }
  }

  function hydrate(userId: string): void {
    storageKey = `${STORAGE_PREFIX}${userId}`;
    if (queue.value.length > 0) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsedJson: unknown = JSON.parse(raw);
      const parsed = persistedSchema.safeParse(parsedJson);
      if (!parsed.success || parsed.data.queue.length === 0) return;
      queue.value = parsed.data.queue;
      index.value = Math.min(Math.max(parsed.data.index, 0), parsed.data.queue.length - 1);
      position.value = parsed.data.position;
      volume.value = parsed.data.volume;
      repeat.value = parsed.data.repeat;
      duration.value = currentTrack.value?.durationSec ?? 0;
      status.value = 'paused';
      getAudio().volume = volume.value;
    } catch {
      // Datos corruptos: se descartan.
    }
  }

  // ---------- enlace con el <audio> ----------
  function attach(): void {
    if (attached) return;
    attached = true;
    const audio = getAudio();
    audio.volume = volume.value;

    const syncBuffered = (): void => {
      buffered.value = readBufferedRanges(audio);
    };

    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) duration.value = audio.duration;
      if (pendingSeek > 0) {
        audio.currentTime = pendingSeek;
        pendingSeek = 0;
      }
      syncBuffered();
    });
    audio.addEventListener('timeupdate', () => {
      const t = audio.currentTime;
      const delta = t - lastTime;
      if (status.value === 'playing' && delta > 0 && delta < 1.5) listenedSinceEvent += delta;
      lastTime = t;
      position.value = t;
      syncBuffered();
      if (listenedSinceEvent >= PROGRESS_EVERY_SEC) emit('progress');
      if (Date.now() - lastPersist > 3000) {
        lastPersist = Date.now();
        persist();
      }
    });
    audio.addEventListener('progress', syncBuffered);
    audio.addEventListener('seeked', syncBuffered);
    audio.addEventListener('playing', () => {
      status.value = 'playing';
      error.value = null;
      if (!playLogged) {
        playLogged = true;
        emit('play');
      }
    });
    audio.addEventListener('waiting', () => {
      if (wantsPlay) status.value = 'buffering';
    });
    audio.addEventListener('pause', () => {
      if (audio.ended || status.value === 'loading' || status.value === 'idle') return;
      status.value = 'paused';
    });
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', () => {
      if (!audio.src) return;
      void recoverFromError(describeMediaError(audio.error));
    });
  }

  async function recoverFromError(message: string): Promise<void> {
    // Un enlace firmado vencido aparece como error de red: se pide uno nuevo una vez.
    if (!recoveredOnce && currentTrack.value) {
      recoveredOnce = true;
      pendingSeek = position.value;
      await loadCurrent(wantsPlay);
      return;
    }
    wantsPlay = false;
    error.value = message;
    status.value = 'error';
  }

  async function loadCurrent(autoplay: boolean): Promise<void> {
    const track = currentTrack.value;
    if (!track) return;
    const audio = getAudio();
    attach();
    loadToken += 1;
    const token = loadToken;
    wantsPlay = autoplay;
    status.value = 'loading';
    error.value = null;
    try {
      const url = await getStreamUrl(track.id);
      if (token !== loadToken) return;
      streamUrl.value = url;
      loadedTrackId = track.id;
      lastTime = 0;
      audio.src = url.url;
      audio.load();
      if (autoplay) {
        await audio.play();
      } else {
        status.value = 'paused';
      }
    } catch (e) {
      if (token !== loadToken) return;
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        status.value = 'paused';
        return;
      }
      if (e instanceof DOMException && e.name === 'AbortError') return;
      wantsPlay = false;
      error.value = toAppError(e).message;
      status.value = 'error';
    }
  }

  function handleEnded(): void {
    emit('complete');
    playLogged = false;
    const next = nextIndex(index.value, queue.value.length, repeat.value);
    const audio = getAudio();
    if (next === null) {
      wantsPlay = false;
      status.value = 'paused';
      position.value = 0;
      audio.currentTime = 0;
      return;
    }
    if (next === index.value) {
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    index.value = next;
    pendingSeek = 0;
    recoveredOnce = false;
    void loadCurrent(true);
  }

  function urlIsStale(): boolean {
    if (!streamUrl.value) return true;
    return Date.parse(streamUrl.value.expiresAt) - Date.now() < URL_REFRESH_MARGIN_MS;
  }

  // ---------- acciones públicas ----------
  function playTrack(track: Track, context: Track[] = [track]): void {
    const startIndex = context.findIndex((t) => t.id === track.id);
    if (startIndex === -1) return;
    if (currentTrack.value?.id === track.id) {
      void toggle();
      return;
    }
    queue.value = [...context];
    index.value = startIndex;
    position.value = 0;
    pendingSeek = 0;
    playLogged = false;
    recoveredOnce = false;
    listenedSinceEvent = 0;
    buffered.value = [];
    duration.value = track.durationSec;
    persist();
    void loadCurrent(true);
  }

  async function toggle(): Promise<void> {
    const track = currentTrack.value;
    if (!track) return;
    const audio = getAudio();
    attach();
    if (isPlaying.value) {
      wantsPlay = false;
      emit('pause');
      audio.pause();
      persist();
      return;
    }
    wantsPlay = true;
    if (loadedTrackId !== track.id || urlIsStale() || status.value === 'error') {
      pendingSeek = position.value;
      recoveredOnce = false;
      await loadCurrent(true);
      return;
    }
    try {
      await audio.play();
    } catch {
      status.value = 'paused';
    }
  }

  function pause(): void {
    if (isPlaying.value) void toggle();
  }

  function seek(seconds: number): void {
    const audio = getAudio();
    const target = Math.min(Math.max(seconds, 0), duration.value || seconds);
    emit('seek');
    position.value = target;
    if (loadedTrackId === currentTrack.value?.id) audio.currentTime = target;
    else pendingSeek = target;
  }

  function skip(deltaSeconds: number): void {
    seek(position.value + deltaSeconds);
  }

  function next(): void {
    const target = nextIndex(index.value, queue.value.length, repeat.value === 'one' ? 'all' : repeat.value);
    if (target === null) return;
    jumpTo(target);
  }

  function previous(): void {
    if (position.value > 3) {
      seek(0);
      return;
    }
    jumpTo(previousIndex(index.value, queue.value.length, repeat.value));
  }

  function jumpTo(target: number): void {
    if (target < 0 || target >= queue.value.length) return;
    index.value = target;
    position.value = 0;
    pendingSeek = 0;
    playLogged = false;
    recoveredOnce = false;
    listenedSinceEvent = 0;
    buffered.value = [];
    duration.value = currentTrack.value?.durationSec ?? 0;
    persist();
    void loadCurrent(true);
  }

  function enqueue(track: Track): void {
    if (queue.value.some((t) => t.id === track.id)) return;
    queue.value = [...queue.value, track];
    if (index.value === -1) {
      index.value = 0;
      duration.value = track.durationSec;
      status.value = 'paused';
    }
    persist();
  }

  function removeFromQueue(removeAt: number): void {
    if (removeAt < 0 || removeAt >= queue.value.length) return;
    const wasCurrent = removeAt === index.value;
    const newIndex = indexAfterRemoval(index.value, removeAt, queue.value.length);
    queue.value = queue.value.filter((_, i) => i !== removeAt);
    if (queue.value.length === 0) {
      reset();
      return;
    }
    index.value = newIndex;
    if (wasCurrent) jumpTo(newIndex);
    else persist();
  }

  function clearQueue(): void {
    reset();
  }

  function setVolume(value: number): void {
    volume.value = Math.min(Math.max(value, 0), 1);
    muted.value = false;
    const audio = getAudio();
    audio.volume = volume.value;
    audio.muted = false;
    persist();
  }

  function toggleMute(): void {
    muted.value = !muted.value;
    getAudio().muted = muted.value;
  }

  function cycleRepeat(): void {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    repeat.value = order[(order.indexOf(repeat.value) + 1) % order.length] ?? 'off';
    persist();
  }

  /** Detiene todo y limpia el estado (cierre de sesión o cola vacía). */
  function reset(): void {
    loadToken += 1;
    wantsPlay = false;
    const audio = getAudio();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignorado
      }
    }
    queue.value = [];
    index.value = -1;
    status.value = 'idle';
    position.value = 0;
    duration.value = 0;
    buffered.value = [];
    streamUrl.value = null;
    error.value = null;
    loadedTrackId = null;
    pendingSeek = 0;
    listenedSinceEvent = 0;
    playLogged = false;
    storageKey = null;
  }

  return {
    queue, index, status, position, duration, buffered, volume, muted, repeat, error, streamUrl,
    currentTrack, isPlaying, bufferAheadSec,
    attach, hydrate, playTrack, toggle, pause, seek, skip, next, previous, jumpTo,
    enqueue, removeFromQueue, clearQueue, setVolume, toggleMute, cycleRepeat, reset,
  };
});
