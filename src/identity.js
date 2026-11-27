/**
 * The one identifier a command's state is keyed by.
 *
 * Every piece of per-session state — the journal record, the single-flight slot,
 * the cancellation handle — has to be found again from the same place, so there
 * is exactly one rule for which id that is. The shell used to resolve it four
 * times as `agent.session?.id ?? agent.id`, and the single-flight slot took
 * `agent.id` while the journal took the session id: a session whose two ids
 * differ would have split one run's state across two keys, so `/code-cancel`
 * and `/code-status` would look in the place the run never wrote to.
 *
 * The session id wins because that is the identity the journal already names
 * its records after; `agent.id` is the fallback for a host that gives an agent
 * without a session. When neither is a usable string the state cannot be keyed
 * at all, and the caller decides what that means rather than inventing a key.
 */
export function sessionKey(agent) {
  const candidates = [agent?.session?.id, agent?.id]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return undefined
}
