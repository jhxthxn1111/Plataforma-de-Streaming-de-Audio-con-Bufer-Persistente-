const SAMPLE_RATE = 11025;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Genera un WAV mono de 16 bits con una melodía determinista según `seed`. */
export function buildToneWav(seed: number, durationSec: number): Uint8Array {
  const totalSamples = Math.floor(SAMPLE_RATE * durationSec);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const root = 196 * 2 ** ((seed % 7) / 12);
  const noteSamples = Math.floor(SAMPLE_RATE * (0.5 + (seed % 3) * 0.125));

  for (let i = 0; i < totalSamples; i += 1) {
    const noteIndex = Math.floor(i / noteSamples);
    const step = scale[(noteIndex * 3 + seed) % scale.length] ?? 0;
    const freq = root * 2 ** (step / 12);
    const t = (i % noteSamples) / SAMPLE_RATE;
    const envelope = Math.min(1, t * 40) * Math.exp(-t * 3);
    const wave = Math.sin(2 * Math.PI * freq * t) * 0.5 + Math.sin(4 * Math.PI * freq * t) * 0.25;
    view.setInt16(44 + i * 2, Math.round(wave * envelope * 0.6 * 32767), true);
  }
  return new Uint8Array(buffer);
}
