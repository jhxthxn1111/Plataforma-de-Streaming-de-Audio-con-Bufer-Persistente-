import * as argon2 from 'argon2';

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** Gasta el mismo tiempo que una verificación real, para que no se pueda saber si un correo existe. */
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hashPassword('contraseña-de-relleno-1');
  await verifyPassword(await dummyHash, plain);
}
