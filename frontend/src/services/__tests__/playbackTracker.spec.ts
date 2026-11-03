import { describe, expect, it } from 'vitest';
import type { PlaybackEvent } from '@/api/contracts';
import { MAX_BATCH, PlaybackTracker, type QueueStorage, type TrackedTrack } from '../playbackTracker';

const A: TrackedTrack = { key: 'cancion.mp3', title: 'Canción 1', artist: 'Archivo local' };
const B: TrackedTrack = { key: 'cancion2.mp3', title: 'Canción 2', artist: 'Archivo local' };

function memoryStorage(): QueueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function setup(storage: QueueStorage = memoryStorage()) {
  const sent: PlaybackEvent[][] = [];
  let failing = false;
  const send = async (events: PlaybackEvent[]): Promise<void> => {
    if (failing) throw new Error('sin conexión');
    sent.push(events);
  };
  const tracker = new PlaybackTracker(send, storage);
  tracker.setOwner('u1');
  return {
    tracker,
    storage,
    sent,
    setFailing: (value: boolean) => {
      failing = value;
    },
  };
}

/** Simula `seconds` de reproducción normal: un timeupdate cada 0,25 s, como hace el navegador. */
function listen(tracker: PlaybackTracker, from: number, seconds: number): number {
  let position = from;
  for (let i = 0; i < seconds * 4; i += 1) {
    position += 0.25;
    tracker.onTimeUpdate(position);
  }
  return position;
}

const types = (tracker: PlaybackTracker): string[] => tracker.queued.map((e) => e.type);
const listened = (tracker: PlaybackTracker): number => tracker.queued.reduce((sum, e) => sum + e.listenedSec, 0);

describe('PlaybackTracker', () => {
  it('registra un play al empezar y no otro al reanudar tras una pausa', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 2);
    tracker.onPause(pos);
    tracker.onPlay(A, pos);
    expect(types(tracker)).toEqual(['play', 'pause']);
  });

  it('acumula el tiempo escuchado y emite un progress cada 15 s', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 31);
    expect(types(tracker)).toEqual(['play', 'progress', 'progress']);
    expect(tracker.queued[1]?.listenedSec).toBe(15);
    tracker.onPause(pos);
    expect(tracker.queued.at(-1)?.listenedSec).toBe(1);
    expect(listened(tracker)).toBe(31);
  });

  it('un salto no cuenta como tiempo escuchado', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 2);
    tracker.onSeeked(100);
    tracker.onTimeUpdate(100.25);
    tracker.onPause(100.25);

    const seek = tracker.queued.find((e) => e.type === 'seek');
    expect(seek?.positionSec).toBe(100);
    expect(seek?.listenedSec).toBe(pos);
    expect(listened(tracker)).toBe(2.3); // 2 s + 0,25 s: los eventos se redondean a décimas, igual que la base de datos
  });

  it('un timeupdate con un avance enorme se ignora aunque no llegue el evento seeked', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    listen(tracker, 0, 1);
    tracker.onTimeUpdate(300);
    tracker.onPause(300);
    expect(listened(tracker)).toBe(1);
  });

  it('al terminar emite complete, y volver a sonar cuenta como un play nuevo', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 3);
    tracker.onPause(pos); // el navegador dispara pause antes de ended
    tracker.onEnded(pos);
    tracker.onPlay(A, 0);
    expect(types(tracker)).toEqual(['play', 'pause', 'complete', 'play']);
    expect(listened(tracker)).toBe(3);
  });

  it('si ended llega sin pause, el tiempo pendiente se guarda en el complete', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 3);
    tracker.onEnded(pos);
    expect(types(tracker)).toEqual(['play', 'complete']);
    expect(tracker.queued[1]?.listenedSec).toBe(3);
  });

  it('al cambiar de canción cierra la anterior y abre la nueva', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    listen(tracker, 0, 2);
    tracker.onPlay(B, 0);
    expect(tracker.queued.map((e) => [e.type, e.trackId])).toEqual([
      ['play', A.key],
      ['pause', A.key],
      ['play', B.key],
    ]);
    expect(tracker.queued[1]?.listenedSec).toBe(2);
  });

  it('cambiar de canción estando en pausa no duplica el pause', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 2);
    tracker.onPause(pos);
    tracker.onPlay(B, 0);
    expect(types(tracker)).toEqual(['play', 'pause', 'play']);
  });

  it('guarda título y artista en cada evento', () => {
    const { tracker } = setup();
    tracker.onPlay(A, 0);
    expect(tracker.queued[0]).toMatchObject({ trackId: A.key, trackTitle: A.title, trackArtist: A.artist });
  });

  it('no registra nada sin usuario', () => {
    const tracker = new PlaybackTracker(async () => undefined, memoryStorage());
    tracker.onPlay(A, 0);
    expect(tracker.queued).toHaveLength(0);
  });

  it('envía en lotes de máximo 100 y deja la cola vacía', async () => {
    const { tracker, sent } = setup();
    tracker.onPlay(A, 0);
    for (let i = 0; i < 249; i += 1) tracker.onSeeked(i);
    await tracker.flush();
    expect(sent.map((batch) => batch.length)).toEqual([MAX_BATCH, MAX_BATCH, 50]);
    expect(tracker.queued).toHaveLength(0);
  });

  it('conserva los eventos si el envío falla y los reintenta en orden', async () => {
    const { tracker, sent, setFailing } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 2);
    tracker.onPause(pos);

    setFailing(true);
    await tracker.flush();
    expect(sent).toHaveLength(0);
    expect(types(tracker)).toEqual(['play', 'pause']);

    setFailing(false);
    await tracker.flush();
    expect(sent.flat().map((e) => e.type)).toEqual(['play', 'pause']);
    expect(tracker.queued).toHaveLength(0);
  });

  it('guarda la cola por usuario y la recupera al volver', async () => {
    const storage = memoryStorage();
    const first = setup(storage);
    first.tracker.onPlay(A, 0);
    first.tracker.onPause(listen(first.tracker, 0, 2));

    const second = setup(storage); // misma "pestaña" recargada, mismo usuario
    expect(types(second.tracker)).toEqual(['play', 'pause']);

    second.tracker.setOwner('u2'); // otro usuario no ve ni envía lo del primero
    expect(second.tracker.queued).toHaveLength(0);
    await second.tracker.flush();
    expect(second.sent).toHaveLength(0);

    second.tracker.setOwner('u1');
    expect(types(second.tracker)).toEqual(['play', 'pause']);
  });

  it('ignora datos corruptos en el almacenamiento', () => {
    const storage = memoryStorage();
    storage.setItem('musica.playback.queue.v1.u1', JSON.stringify([{ nada: true }, 'x', null]));
    const { tracker } = setup(storage);
    expect(tracker.queued).toHaveLength(0);
  });

  it('checkpoint registra lo escuchado sin cerrar la sesión y la reproducción sigue sumando', async () => {
    const { tracker, sent } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 7);
    await tracker.checkpoint(pos);
    expect(sent.flat().map((e) => [e.type, e.listenedSec])).toEqual([
      ['play', 0],
      ['progress', 7],
    ]);

    const end = listen(tracker, pos, 3);
    tracker.onPause(end);
    expect(listened(tracker)).toBe(3);
    expect(types(tracker)).toEqual(['pause']); // sin un segundo "play"
  });

  it('stop cierra la sesión y envía todo', async () => {
    const { tracker, sent } = setup();
    tracker.onPlay(A, 0);
    const pos = listen(tracker, 0, 4);
    await tracker.stop(pos);
    expect(sent.flat().map((e) => e.type)).toEqual(['play', 'pause']);
    tracker.onPause(pos); // el pause del <audio> llega tarde: ya no hay sesión
    expect(tracker.queued).toHaveLength(0);
  });
});
