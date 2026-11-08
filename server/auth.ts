import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const got = scryptSync(pw, Buffer.from(saltHex, "hex"), expected.length, { N: 16384, r: 8, p: 1 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const newToken = () => randomBytes(32).toString("hex");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newInviteCode(): string {
  const b = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}

export const USERNAME_RE = /^[a-z0-9._]{3,24}$/;

/** 16-char recovery code (80 bits), shown as XXXX-XXXX-XXXX-XXXX. Only its hash is stored. */
export function newRecoveryCode(): string {
  const b = randomBytes(16);
  let s = "";
  for (let i = 0; i < 16; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s.match(/.{4}/g)!.join("-");
}
export const normRecovery = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const recoveryHash = (c: string) => sha256(`corpus-recovery:${normRecovery(c)}`);
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
