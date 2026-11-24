/** Sum a list of values, coercing numeric strings. */
export function sum(values) {
  let total = 0
  for (const value of values) total += Number(value)
  return total
}
