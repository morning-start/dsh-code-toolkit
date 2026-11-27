import { randomUUID } from 'node:crypto'

/** System-prompt section that carries an agent's persona prefix. */
const PERSONA_SECTION = 'DEPLOYMENT_PERSONA_PREFIX'

/** Delegation tools a review/simplify child must not call: it must not fan out again. */
const DELEGATE_TOOLS = [
  'subagent',
  'subagent_fork',
  'workflow',
  'list_agents',
  'send_message',
  'wait_agent',
  'interrupt_agent',
  'summon_expert',
  'summon_experts',
  'list_experts',
]

/**
 * Run one isolated subagent with an injected persona.
 *
 * Requires the native `spawn` provider, whose `inheritsParentContext` is false:
 * the child must read the code itself instead of inheriting this conversation.
 * Without that, a review only sees what the main agent already believes.
 *
 * The persona is attached from an `agent/created` listener keyed on the child id
 * the plugin hands the host. The listener stays up until the run is over, because
 * the child may be created after `startActivation` resolves; if it were removed
 * the moment the activation settled, the persona would silently never attach.
 * When the run finishes without the listener ever firing, the child ran without
 * a persona — which is exactly the silent failure this function refuses to allow.
 */
export async function runIsolatedAgent(ctx, parent, options) {
  const { persona, prompt, label, signal, model, t } = options

  const subagents = ctx.subagents
  if (!subagents) throw new Error(t('error.noProvider'))
  if (typeof subagents.startActivation !== 'function') throw new Error(t('error.noActivation'))

  const provider = subagents.getProvider('spawn')
  if (!provider) throw new Error(t('error.noProvider'))
  if (provider.inheritsParentContext) throw new Error(t('error.noProvider'))

  const childId = randomUUID()
  const deny = DELEGATE_TOOLS.filter((name) => ctx.tools.get(name, parent) !== undefined)

  let injected = false
  const stopWatching = ctx.on('agent/created', ({ agent }) => {
    if (agent.id !== childId) return
    injected = true
    agent.ctx.systemPrompt.section({
      name: PERSONA_SECTION,
      order: agent.ctx.systemPrompt.getSectionOrder(PERSONA_SECTION),
      text: persona,
    })
    if (deny.length) agent.ctx.tools.restrict({ deny })
  })

  let activation
  try {
    // 0.2.2-rc.1 takes a nested `request`; rc.2+ takes a flat spec and exposes
    // `rootOf`. Keep both so the declared engine range stays honest.
    const flat = typeof subagents.rootOf === 'function'
    const request = {
      parent,
      prompt: [{ type: 'text', text: prompt }],
      ...(model ? { agentOptions: { model } } : {}),
    }
    activation = await subagents.startActivation({
      provider: 'spawn',
      label,
      childId,
      signal,
      delivery: 'caller',
      ...(flat ? request : { request }),
    })

    const result = await activation.result
    if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    if (result.stopReason !== 'completed') {
      const detail = result.diagnostic ? ` — ${result.diagnostic}` : ''
      throw new Error(`${t('error.noResult')} (${result.stopReason}${detail})`)
    }
    const text = result.output
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
    if (!text) throw new Error(t('error.noResult'))
    // The child may finish before its own creation event reaches this listener.
    // A run that never saw the child is one that ran without the persona, which
    // is a silent failure worth failing loudly instead of reporting as a report.
    if (!injected) throw new Error(t('error.noPersona'))
    return text
  } finally {
    stopWatching()
    if (activation) {
      try {
        await activation.dispose()
      } catch {
        /* the session may already be gone */
      }
    }
  }
}
