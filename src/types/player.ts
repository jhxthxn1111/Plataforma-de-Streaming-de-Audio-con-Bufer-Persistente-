export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
export type RepeatMode = 'off' | 'all' | 'one';

/** Rango de audio ya descargado, en segundos. */
export interface BufferedRange {
  start: number;
  end: number;
}

export type IconName =
  | 'play' | 'pause' | 'next' | 'previous' | 'volume' | 'mute'
  | 'repeat' | 'repeat-one' | 'queue' | 'plus' | 'close' | 'search'
  | 'library' | 'chart' | 'shield' | 'logout' | 'wave';
