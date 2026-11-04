import { describe, expect, it } from 'vitest';
import { RENEWAL_COOLDOWN_MS, shouldRenewTicket, type RenewalContext } from '../ticketRenewal';

const base: RenewalContext = {
  isFromCache: false,
  isOnline: true,
  hasStreamSource: true,
  mediaErrorCode: 2,
  lastRenewalAt: 0,
  now: 1_000_000,
};

describe('shouldRenewTicket', () => {
  it('renueva ante un fallo de red o de fuente al hacer streaming', () => {
    expect(shouldRenewTicket(base)).toBe(true);
    expect(shouldRenewTicket({ ...base, mediaErrorCode: 4 })).toBe(true);
  });

  it('no renueva si el audio sale de disco, si no hay conexión o si no hay URL cargada', () => {
    expect(shouldRenewTicket({ ...base, isFromCache: true })).toBe(false);
    expect(shouldRenewTicket({ ...base, isOnline: false })).toBe(false);
    expect(shouldRenewTicket({ ...base, hasStreamSource: false })).toBe(false);
  });

  it('no renueva ante errores que un ticket nuevo no arregla (abortado, decodificación) ni sin error', () => {
    expect(shouldRenewTicket({ ...base, mediaErrorCode: 1 })).toBe(false);
    expect(shouldRenewTicket({ ...base, mediaErrorCode: 3 })).toBe(false);
    expect(shouldRenewTicket({ ...base, mediaErrorCode: null })).toBe(false);
  });

  it('respeta el tiempo de espera entre renovaciones para no entrar en bucle', () => {
    expect(shouldRenewTicket({ ...base, lastRenewalAt: base.now - 1000 })).toBe(false);
    expect(shouldRenewTicket({ ...base, lastRenewalAt: base.now - RENEWAL_COOLDOWN_MS })).toBe(true);
  });
});
