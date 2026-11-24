import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { outputLanguage, readHostLocale, resolveLocale, translate } from './src/i18n.js'
import { Journal } from './src/journal.js'
import { parseReport, renderReport } from './src/report.js'
import { scopeInstruction, scopeLabel, selectScope } from './src/selection.js'
import { runIsolatedAgent } from './src/runtime.js'

export const name = 'morning-start-code-quality'
export const inject = ['commands', 'subagents', 'systemPrompt', 'tools']

const ROOT = dirname(fileURLToPath(import.meta.url))

/** The persona lives next to its reference files; the child may read them on demand. */
function loadPersona(role) {
  const directory = join(ROOT, 'agents', role)
  return {
    directory,
    text: readFileSync(join(directory, 'AGENT.md'), 'utf8'),
  }
}

/** Assemble the concrete task handed to the isolated agent. */
async function buildPrompt({ persona, scope, mode, cwd, locale, signal, dryRunText }) {
  return [
    `Working directory: ${cwd}`,
    `Reference directory: ${persona.directory}`,
    '',
    await scopeInstruction(scope, { cwd, signal }),
    '',
    `Mode: ${mode}.`,
    mode === 'dry-run'
      ? dryRunText
      : 'Apply the changes, then verify that behavior is unchanged. If verification fails, revert that change and report it.',
    '',
    outputLanguage(locale),
  ].join('\n')
}

export function apply(ctx, config = {}) {
  const fallbackLocale = resolveLocale(config.locale)
  /** An explicit config.locale wins; otherwise the host's preference decides. */
  const forcedLocale = config.locale === undefined ? undefined : resolveLocale(config.locale)

  if (config.reportDirectory !== undefined && !isAbsolute(config.reportDirectory)) {
    throw new Error(translate(fallbackLocale, 'error.reportDirectory'))
  }
  if (config.reviewModel !== undefined && !String(config.reviewModel).trim()) {
    throw new Error(translate(fallbackLocale, 'error.model'))
  }
  if (config.simplifyModel !== undefined && !String(config.simplifyModel).trim()) {
    throw new Error(translate(fallbackLocale, 'error.model'))
  }
  if (config.scrubModel !== undefined && !String(config.scrubModel).trim()) {
    throw new Error(translate(fallbackLocale, 'error.model'))
  }

  const journal = new Journal(config.reportDirectory ?? Journal.defaultDirectory())
  const simplifyPersona = loadPersona('simplify')
  const reviewPersona = loadPersona('review')
  const scrubPersona = loadPersona('scrub')

  /** agentId -> { controller, label, startedAt } */
  const running = new Map()

  ctx.effect(() => () => {
    for (const entry of running.values()) entry.controller.abort()
    running.clear()
  })

  function localeNow() {
    return forcedLocale ?? readHostLocale(ctx, fallbackLocale)
  }

  async function execute(agent, rawInput, signal, options) {
    const key = agent.id
    const locale = localeNow()
    const t = (name) => translate(locale, name)
    if (running.has(key)) return { kind: 'error', text: t('error.busy') }

    const cwd = agent.session?.header?.cwd
    if (!cwd) return { kind: 'error', text: t('error.noCwd') }

    const controller = new AbortController()
    const combined = AbortSignal.any([signal, controller.signal])
    running.set(key, { controller, label: options.label, startedAt: Date.now() })

    const sessionId = agent.session?.id ?? agent.id
    try {
      const { scope, apply: applyMode } = await selectScope(ctx, agent, rawInput, combined, t)
      if (!scope) return { kind: 'error', text: t('error.noScope') }

      const mode = options.forceDryRun || !applyMode ? 'dry-run' : 'apply'
      const prompt = await buildPrompt({
        persona: options.persona,
        scope,
        mode,
        cwd,
        locale,
        signal: combined,
        dryRunText: options.dryRunText ?? 'Report only. Change no files.',
      })

      await journal
        .write(sessionId, {
          state: 'running',
          command: options.command,
          scope: scopeLabel(scope),
          mode,
          at: new Date().toISOString(),
        })
        .catch(() => undefined)

      const raw = await runIsolatedAgent(ctx, agent, {
        persona: `${options.persona.text}\n\n${outputLanguage(locale)}`,
        prompt,
        label: options.label,
        signal: combined,
        model: options.model,
        t,
      })

      const body = options.structured
        ? renderReport(parseReport(raw), t)
        : raw
      const text = [`> ${scopeLabel(scope)} · ${mode}`, '', body].join('\n')

      await journal
        .write(sessionId, {
          state: 'finished',
          command: options.command,
          scope: scopeLabel(scope),
          mode,
          result: text,
          at: new Date().toISOString(),
        })
        .catch(() => undefined)

      return { kind: 'success', text }
    } catch (error) {
      if (combined.aborted) return { kind: 'error', text: t('error.aborted') }
      const message = error instanceof Error ? error.message : String(error)
      return { kind: 'error', text: message }
    } finally {
      running.delete(key)
    }
  }

  ctx.commands.register({
    name: 'code-simplify',
    description: translate(localeNow(), 'cmd.simplify'),
    input: { hint: translate(localeNow(), 'hint.scope') },
    handler({ agent, rawInput, signal }) {
      return execute(agent, rawInput, signal, {
        command: 'simplify',
        persona: simplifyPersona,
        label: translate(localeNow(), 'cmd.simplify'),
        model: config.simplifyModel,
        forceDryRun: false,
        structured: false,
        dryRunText: 'Produce the plan only. Change no files.',
      })
    },
  })

  ctx.commands.register({
    name: 'code-scrub',
    description: translate(localeNow(), 'cmd.scrub'),
    input: { hint: translate(localeNow(), 'hint.scrub') },
    handler({ agent, rawInput, signal }) {
      return execute(agent, rawInput, signal, {
        command: 'scrub',
        persona: scrubPersona,
        label: translate(localeNow(), 'cmd.scrub'),
        model: config.scrubModel,
        forceDryRun: false,
        structured: true,
        dryRunText: 'Report only. Change no files, and never reproduce a secret in the report.',
      })
    },
  })

  ctx.commands.register({
    name: 'code-review',
    description: translate(localeNow(), 'cmd.review'),
    input: { hint: translate(localeNow(), 'hint.scope') },
    handler({ agent, rawInput, signal }) {
      return execute(agent, rawInput, signal, {
        command: 'review',
        persona: reviewPersona,
        label: translate(localeNow(), 'cmd.review'),
        model: config.reviewModel,
        forceDryRun: true,
        structured: true,
      })
    },
  })

  ctx.commands.register({
    name: 'code-status',
    description: translate(localeNow(), 'cmd.status'),
    async handler({ agent }) {
      const locale = localeNow()
      const t = (key) => translate(locale, key)
      const entry = running.get(agent.id)
      if (entry) return { kind: 'success', text: `${t('status.running')}${entry.label}` }

      const record = await journal.read(agent.session?.id ?? agent.id).catch(() => undefined)
      if (!record) return { kind: 'success', text: t('status.none') }
      if (record.state === 'running') return { kind: 'success', text: t('status.interrupted') }
      return { kind: 'success', text: `${t('status.last')}${record.scope} · ${record.mode}\n\n${record.result}` }
    },
  })

  ctx.commands.register({
    name: 'code-cancel',
    description: translate(localeNow(), 'cmd.cancel'),
    handler({ agent }) {
      const locale = localeNow()
      const entry = running.get(agent.id)
      if (!entry) return { kind: 'success', text: translate(locale, 'cancel.none') }
      entry.controller.abort()
      return { kind: 'success', text: translate(locale, 'cancel.done') }
    },
  })
}
