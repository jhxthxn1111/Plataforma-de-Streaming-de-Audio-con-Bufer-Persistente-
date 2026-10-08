export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatListening(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  if (rounded < 60) return `${rounded} s`;
  if (rounded < 3600) return `${Math.round(rounded / 60)} min`;
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.round((rounded % 3600) / 60);
  return `${hours} h ${minutes} min`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/** '2026-10-07' -> '07/10' */
export function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${day}/${month}`;
}
