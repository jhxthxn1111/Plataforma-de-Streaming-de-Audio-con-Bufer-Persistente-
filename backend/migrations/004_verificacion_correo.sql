-- Verificación de correo y recuperación de contraseña.
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
-- Las cuentas que ya existían se consideran verificadas para que nadie quede fuera.
UPDATE users SET email_verified_at = created_at;

-- Enlaces de un solo uso enviados por correo. Solo se guarda el hash del token, nunca el token.
CREATE TABLE email_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_purpose_idx ON email_tokens (user_id, purpose, created_at DESC);
