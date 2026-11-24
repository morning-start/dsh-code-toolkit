export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`
}
