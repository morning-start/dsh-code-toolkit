/** A token is expired once now is at or past its expiry. */
export function isExpired(expiresAt, now) {
  return now > expiresAt
}
