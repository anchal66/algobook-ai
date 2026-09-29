/** 6-digit join codes (Module 06). Uniqueness among live rooms is enforced by the `roomCodes` lock; this is the generator. */
export const CODE_LENGTH = 6;
export const CODE_RE = /^\d{6}$/;

export function generateCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += String(Math.floor(rand() * 10));
  return out;
}

export function normalizeCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return CODE_RE.test(digits) ? digits : null;
}

export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
