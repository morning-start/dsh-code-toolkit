/** Round a cent amount to the nearest whole cent. */
export function roundCents(value) {
  return Math.floor(value * 100) / 100
}
