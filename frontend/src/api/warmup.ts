import { env } from '@/config/env';

/**
 * Los servidores gratuitos se duermen tras 15 minutos sin tráfico y tardan cerca de un minuto en despertar,
 * más que el tiempo máximo de una petición (15 s). Se avisa al servidor apenas abre la página, para que ya esté
 * despierto cuando la persona termine de escribir su correo y su contraseña. No espera respuesta ni muestra errores.
 */
export function warmUpApi(): void {
  if (env.useMock || !/^https?:\/\//.test(env.apiBaseUrl)) return;
  void fetch(`${env.apiBaseUrl.replace(/\/$/, '')}/health`, { cache: 'no-store' }).catch(() => undefined);
}
