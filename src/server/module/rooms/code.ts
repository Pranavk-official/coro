import { randomInt } from "node:crypto";

export const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz";
export const CODE_SHAPE = [3, 4, 3] as const;

export function generateCode(): string {
  const pick = (n: number) =>
    Array.from({ length: n }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}
