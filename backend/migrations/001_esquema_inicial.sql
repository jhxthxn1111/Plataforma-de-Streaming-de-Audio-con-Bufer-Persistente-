CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'listener' CHECK (role IN ('listener', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- El correo es único sin distinguir mayúsculas.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,   -- solo el hash, nunca el token
  family_id   uuid NOT NULL,          -- cadena de rotación: permite revocarla completa
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

CREATE TABLE tracks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  artist       text NOT NULL,
  album        text NOT NULL,
  genre        text NOT NULL,
  duration_sec integer NOT NULL CHECK (duration_sec > 0),
  bitrate_kbps integer NOT NULL CHECK (bitrate_kbps > 0),
  size_bytes   bigint  NOT NULL CHECK (size_bytes >= 0),
  file_path    text NOT NULL,          -- ruta en disco; nunca se expone al cliente
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracks_genre_idx ON tracks (genre);

CREATE TABLE playback_events (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id     uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('play', 'pause', 'progress', 'seek', 'complete')),
  position_sec numeric(8,1) NOT NULL CHECK (position_sec >= 0),
  listened_sec numeric(8,1) NOT NULL CHECK (listened_sec >= 0),
  occurred_at  timestamptz NOT NULL
);
CREATE INDEX playback_events_user_time_idx ON playback_events (user_id, occurred_at);
CREATE INDEX playback_events_track_idx ON playback_events (track_id);
