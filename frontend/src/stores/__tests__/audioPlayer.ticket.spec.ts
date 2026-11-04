import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Renovación del ticket de audio: tras 5 minutos el ticket caduca, y saltar por la canción hace que el servidor
 * responda 401. El reproductor debe pedir un ticket nuevo y retomar donde iba, una sola vez por fallo.
 */

const { ticketMock, FakeAudio } = vi.hoisted(() => {
  const ticketMock = vi.fn();

  class FakeAudio extends EventTarget {
    static last: FakeAudio;
    src = '';
    currentTime = 0;
    duration = 300;
    paused = true;
    volume = 1;
    preload = '';
    crossOrigin: string | null = null;
    buffered = { length: 0, start: () => 0, end: () => 0 };
    error: { code: number } | null = null;
    play = vi.fn(() => {
      this.paused = false;
      return Promise.resolve();
    });

    constructor() {
      super();
      FakeAudio.last = this;
    }
    getAttribute(name: string): string | null {
      return name === 'src' && this.src ? this.src : null;
    }
    removeAttribute(): void {
      this.src = '';
    }
    pause(): void {
      this.paused = true;
    }
    /** Como un <audio> real: al cargar una fuente vuelve al inicio y avisa de que ya tiene metadatos. */
    load(): void {
      this.currentTime = 0;
      queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
    }
  }
  return { ticketMock, FakeAudio };
});

vi.stubGlobal('Audio', FakeAudio);
vi.mock('../../api/audio', () => ({
  getLocalCatalog: vi.fn().mockResolvedValue([]),
  requestSignedStreamUrl: ticketMock,
}));
vi.mock('../../api/analytics', () => ({ sendPlaybackEvents: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../offlineCache.store', () => ({
  useOfflineCacheStore: () => ({
    isOnline: true,
    autoCache: false,
    whenReady: () => Promise.resolve(),
    getBlobUrl: () => Promise.resolve(null),
    download: vi.fn(),
  }),
}));

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};
const failWith = (audio: InstanceType<typeof FakeAudio>, code: number): void => {
  audio.error = { code };
  audio.dispatchEvent(new Event('error'));
};

async function setup() {
  vi.resetModules(); // estado del módulo (el <audio> y los listeners) limpio en cada prueba
  setActivePinia(createPinia());
  const { useAudioPlayerStore } = await import('../audioPlayer.store');
  const store = useAudioPlayerStore();
  await flush();
  return { store, audio: FakeAudio.last };
}

describe('renovación del ticket de audio', () => {
  let n: number;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T10:00:00Z'));
    n = 0;
    ticketMock.mockReset();
    ticketMock.mockImplementation(() => Promise.resolve(`http://localhost:3000/api/audio/stream/cancion.mp3?expires=${++n}&signature=s`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('al fallar un salto por ticket vencido pide uno nuevo, retoma la posición y sigue sonando', async () => {
    const { store, audio } = await setup();
    await store.playTrack('cancion.mp3');
    await flush();
    const ticketsBefore = ticketMock.mock.calls.length;
    const firstUrl = audio.src;

    vi.setSystemTime(new Date('2026-11-04T10:06:00Z')); // pasaron 6 min: el ticket ya caducó
    store.seek(200);
    failWith(audio, 4);
    await flush();

    expect(ticketMock).toHaveBeenCalledTimes(ticketsBefore + 1);
    expect(audio.src).not.toBe(firstUrl);
    expect(audio.currentTime).toBe(200);
    expect(audio.play).toHaveBeenCalledTimes(2); // la reproducción inicial y la reanudación
    expect(store.isPlaying).toBe(true);
    expect(store.streamError).toBeNull();
  });

  it('si estaba en pausa retoma la posición pero no se pone a sonar', async () => {
    const { store, audio } = await setup();
    await store.playTrack('cancion.mp3');
    await flush();
    audio.dispatchEvent(new Event('pause')); // la persona pausa
    expect(store.isPlaying).toBe(false);
    const ticketsBefore = ticketMock.mock.calls.length;

    vi.setSystemTime(new Date('2026-11-04T10:06:00Z'));
    store.seek(120);
    failWith(audio, 2);
    await flush();

    expect(ticketMock).toHaveBeenCalledTimes(ticketsBefore + 1);
    expect(audio.currentTime).toBe(120);
    expect(audio.play).toHaveBeenCalledTimes(1); // solo la inicial
    expect(store.isPlaying).toBe(false);
  });

  it('no entra en bucle: si el ticket nuevo también falla enseguida, muestra el error', async () => {
    const { store, audio } = await setup();
    await store.playTrack('cancion.mp3');
    await flush();
    const ticketsBefore = ticketMock.mock.calls.length;

    vi.setSystemTime(new Date('2026-11-04T10:06:00Z'));
    failWith(audio, 4);
    await flush();
    const afterRenewal = ticketMock.mock.calls.length;
    expect(afterRenewal).toBe(ticketsBefore + 1); // la primera vez sí renueva

    failWith(audio, 4); // el servidor sigue rechazando, dentro del tiempo de espera
    await flush();

    expect(ticketMock).toHaveBeenCalledTimes(afterRenewal);
    expect(store.streamError).toContain('401');
    expect(store.isPlaying).toBe(false);
  });

  it('en una canción larga renueva otra vez cuando caduca el segundo ticket', async () => {
    const { store, audio } = await setup();
    await store.playTrack('cancion.mp3');
    await flush();

    vi.setSystemTime(new Date('2026-11-04T10:06:00Z'));
    failWith(audio, 4);
    await flush();
    const afterFirst = ticketMock.mock.calls.length;

    vi.setSystemTime(new Date('2026-11-04T10:12:00Z'));
    failWith(audio, 4);
    await flush();

    expect(ticketMock).toHaveBeenCalledTimes(afterFirst + 1);
    expect(store.streamError).toBeNull();
  });

  it('un error de decodificación no gasta tickets: sigue el mensaje de siempre', async () => {
    const { store, audio } = await setup();
    await store.playTrack('cancion.mp3');
    await flush();
    const tickets = ticketMock.mock.calls.length;

    failWith(audio, 3);
    await flush();

    expect(ticketMock).toHaveBeenCalledTimes(tickets);
    expect(store.streamError).toContain('401');
  });
});
