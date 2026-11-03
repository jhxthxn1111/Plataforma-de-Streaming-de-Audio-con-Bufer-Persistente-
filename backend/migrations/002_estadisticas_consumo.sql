-- Estadísticas de consumo: los eventos de reproducción dejan de depender de la tabla `tracks`.
-- El catálogo real son archivos en /storage, así que cada evento guarda la clave de la canción
-- (su nombre de archivo) junto con el título y el artista del momento. `track_id` queda como
-- vínculo opcional por si algún día el catálogo pasa a vivir en la base.

ALTER TABLE playback_events ALTER COLUMN track_id DROP NOT NULL;

-- Borrar una canción del catálogo ya no borra el historial de quien la escuchó.
ALTER TABLE playback_events DROP CONSTRAINT IF EXISTS playback_events_track_id_fkey;
ALTER TABLE playback_events
  ADD CONSTRAINT playback_events_track_id_fkey
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL;

ALTER TABLE playback_events
  ADD COLUMN track_key    text,
  ADD COLUMN track_title  text,
  ADD COLUMN track_artist text;

-- Las filas anteriores sí tenían track_id: se conserva como clave.
UPDATE playback_events e
   SET track_key = e.track_id::text, track_title = t.title, track_artist = t.artist
  FROM tracks t
 WHERE t.id = e.track_id;

ALTER TABLE playback_events ALTER COLUMN track_key SET NOT NULL;

CREATE INDEX playback_events_user_track_idx ON playback_events (user_id, track_key);
