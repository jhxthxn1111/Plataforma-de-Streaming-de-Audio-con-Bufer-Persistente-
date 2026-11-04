/** URL base del backend, sin el sufijo /api ni la barra final. */
export const getCleanBaseUrl = (): string => {
  const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000';
  return rawBase.replace(/\/api\/?$/, '').replace(/\/$/, '');
};
