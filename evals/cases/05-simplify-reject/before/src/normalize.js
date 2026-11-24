export function normalizeCount(input) {
  const value = Number(input)
  if (value === 0) {
    return null
  } else {
    return value
  }
}
