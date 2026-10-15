export interface MockTrackSeed {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  durationSec: number;
  bitrateKbps: number;
  hue: number;
  seed: number;
}

export const MOCK_TRACKS: MockTrackSeed[] = [
  { id: 't01', title: 'Madrugada en el muelle', artist: 'Lía Montoya', album: 'Mareas', genre: 'Ambiental', durationSec: 62, bitrateKbps: 256, hue: 205, seed: 1 },
  { id: 't02', title: 'Cuadrante norte', artist: 'Tres Voltios', album: 'Cableado', genre: 'Electrónica', durationSec: 48, bitrateKbps: 320, hue: 265, seed: 2 },
  { id: 't03', title: 'Café con hielo', artist: 'Sexteto Alameda', album: 'Tarde de lunes', genre: 'Jazz', durationSec: 71, bitrateKbps: 192, hue: 28, seed: 3 },
  { id: 't04', title: 'Lluvia sobre zinc', artist: 'Lía Montoya', album: 'Mareas', genre: 'Ambiental', durationSec: 55, bitrateKbps: 256, hue: 190, seed: 4 },
  { id: 't05', title: 'Frecuencia 44', artist: 'Tres Voltios', album: 'Cableado', genre: 'Electrónica', durationSec: 66, bitrateKbps: 320, hue: 300, seed: 5 },
  { id: 't06', title: 'Nocturno en la menor', artist: 'Camila Orrego', album: 'Piano de cámara', genre: 'Clásica', durationSec: 74, bitrateKbps: 320, hue: 345, seed: 6 },
  { id: 't07', title: 'Bulevar a las tres', artist: 'Sexteto Alameda', album: 'Tarde de lunes', genre: 'Jazz', durationSec: 52, bitrateKbps: 192, hue: 40, seed: 7 },
  { id: 't08', title: 'Estudio para dos manos', artist: 'Camila Orrego', album: 'Piano de cámara', genre: 'Clásica', durationSec: 58, bitrateKbps: 320, hue: 10, seed: 8 },
  { id: 't09', title: 'Niebla de montaña', artist: 'Río Abajo', album: 'Cumbres', genre: 'Ambiental', durationSec: 69, bitrateKbps: 256, hue: 160, seed: 9 },
  { id: 't10', title: 'Pulso de ciudad', artist: 'Tres Voltios', album: 'Cableado', genre: 'Electrónica', durationSec: 45, bitrateKbps: 256, hue: 235, seed: 10 },
  { id: 't11', title: 'Baladas de segunda mano', artist: 'Sexteto Alameda', album: 'Tarde de lunes', genre: 'Jazz', durationSec: 64, bitrateKbps: 192, hue: 55, seed: 11 },
  { id: 't12', title: 'Aurora boreal', artist: 'Río Abajo', album: 'Cumbres', genre: 'Ambiental', durationSec: 73, bitrateKbps: 256, hue: 120, seed: 12 },
];
