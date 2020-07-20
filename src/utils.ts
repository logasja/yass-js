// As the name implies, returns a number clamped to unsigned 8 bit
export function clampTo8bit(a: number): number {
  return a < 0 ? 0 : a > 255 ? 255 : a;
}
