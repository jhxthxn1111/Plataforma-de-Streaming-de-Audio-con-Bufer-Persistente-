/**
 * El access token vive solo en memoria (variable de módulo).
 * Nunca se escribe en localStorage/sessionStorage: el refresh token viaja
 * en una cookie HttpOnly que JavaScript no puede leer.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string): void => {
    accessToken = token;
  },
  clear: (): void => {
    accessToken = null;
  },
};
