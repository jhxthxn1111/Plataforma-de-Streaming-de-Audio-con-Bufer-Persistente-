-- Playlists por usuario. Cada playlist pertenece a una sola persona (user_id).
-- Las canciones se guardan por su clave de catálogo (el nombre del archivo), igual que playback_events:
-- el catálogo real son archivos en /storage, no filas en la tabla `tracks`.

CREATE TABLE playlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX playlists_user_idx ON playlists (user_id, created_at);
-- Una persona no puede repetir el nombre de una playlist (sin distinguir mayúsculas).
CREATE UNIQUE INDEX playlists_user_name_unique ON playlists (user_id, lower(name));

CREATE TABLE playlist_tracks (
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_key   text NOT NULL CHECK (char_length(track_key) BETWEEN 1 AND 200),
  position    integer NOT NULL CHECK (position > 0),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_key)   -- una canción no se repite dentro de la misma playlist
);
CREATE INDEX playlist_tracks_order_idx ON playlist_tracks (playlist_id, position);
