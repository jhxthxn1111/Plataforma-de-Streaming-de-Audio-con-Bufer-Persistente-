import type { BufferedRange } from '@/types/player';

/**
 * Un único HTMLAudioElement para toda la aplicación, creado fuera de cualquier
 * componente. El router cambia de vista, pero este elemento no se destruye,
 * así que la reproducción y el búfer sobreviven a la navegación.
 */
let audio: HTMLAudioElement | null = null;

export function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
  }
  return audio;
}

export function readBufferedRanges(element: HTMLAudioElement): BufferedRange[] {
  const ranges: BufferedRange[] = [];
  for (let i = 0; i < element.buffered.length; i += 1) {
    ranges.push({ start: element.buffered.start(i), end: element.buffered.end(i) });
  }
  return ranges;
}

export function describeMediaError(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_NETWORK:
      return 'Se interrumpió la descarga del audio. Revisa tu conexión.';
    case MediaError.MEDIA_ERR_DECODE:
      return 'No se pudo decodificar el audio.';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'El audio no está disponible o su enlace venció.';
    default:
      return 'No se pudo reproducir esta canción.';
  }
}
