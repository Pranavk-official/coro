/** Up to two capital letters for an avatar fallback: "Dana Scully" → "DS". */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
