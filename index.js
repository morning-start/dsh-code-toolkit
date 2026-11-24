import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { outputLanguage, readHostLocale, resolveLocale, translate } from './src/i18n.js'
import { Journal } from './src/journal.js'
import { parseReport, renderReport } from './src/report.js'
import { buildPua, flavorList, resolveFlavor } from './src/pua.js'
import { runIsolatedAgent } from './src/runtime.js'
import { SessionCommand } from './src/command.js'

export const name = 'morning-start-code-toolkit'
export const inject = ['commands', 'subagents', 'systemPrompt', 'tools']

const ROOT = dirname(fileURLToPath(import.meta.url))

/** The persona lives next to its reference files; the reader may open them on demand. */
function loadPersona(role) {
  const directory = join(ROOT, 'agents', role)
  return {
    directory,
    text: readFileSync(join(directory, 'AGENT.md'), 'utf8'),
  }
}

export function apply(ctx, config = {}) {
  const fallbackLocale = resolveLocale(config.locale)
  /** An explicit config.locale wins; otherwise the host's preference decides. */
  const forcedLocale = config.locale === undefined ? undefined : resolveLocale(config.locale)

  if (config.reportDirectory !== undefined && !isAbsolute(config.reportDirectory)) {
    throw new Error(translate(fallbackLocale, 'error.reportDirectory'))
  }
  for (const key of ['reviewModel', 'simplifyModel', 'scrubModel']) {
    if (config[key] !== undefined && !String(config[key]).trim()) {
      throw new Error(translate(fallbackLocale, 'error.model'))
    }
  }

  const journal = new Journal(config.reportDirectory ?? Journal.defaultDirectory())
  const personas = {
    simplify: loadPersona('simplify'),
    review: loadPersona('review'),
    scrub: loadPersona('scrub'),
    caption: loadPersona('caption'),
    pua: loadPersona('pua'),
  }

  /** agentId -> { controller, label, startedAt } for the isolated runs. */
  const running = new Map()

  ctx.effect(() => () => {
    for (const entry of running.values()) entry.controller.abort()
    running.clear()
  })

  const localeNow = () => forcedLocale ?? readHostLocale(ctx, fallbackLocale)

  /** Everything a command needs from the plugin, in one place. */
  const host = {
    ctx,
    journal,
    running,
    localeNow,
    translate: (locale, key) => translate(locale, key),
    deliver(agent, message) {
      try {
        agent.followup(message)
      } catch {
        /* session disposed or unavailable */
      }
    },
    runIsolatedAgent: (agent, options) => runIsolatedAgent(ctx, agent, options),
    parseReport,
    renderReport,
  }

  const commands = [
    new SessionCommand({
      name: 'code-simplify',
      command: 'simplify',
      descriptionKey: 'cmd.simplify',
      hintKey: 'hint.scope',
      persona: personas.simplify,
      model: config.simplifyModel,
      forceDryRun: false,
      structured: false,
      dryRunText: 'Produce the plan only. Change no files.',
    }, host),
    new SessionCommand({
      name: 'code-scrub',
      command: 'scrub',
      descriptionKey: 'cmd.scrub',
      hintKey: 'hint.scrub',
      persona: personas.scrub,
      model: config.scrubModel,
      forceDryRun: false,
      structured: true,
      dryRunText: 'Report only. Change no files, and never reproduce a secret in the report.',
    }, host),
    new SessionCommand({
      name: 'code-review',
      command: 'review',
      descriptionKey: 'cmd.review',
      hintKey: 'hint.scope',
      persona: personas.review,
      model: config.reviewModel,
      forceDryRun: true,
      structured: true,
      dryRunText: 'Report only. Change no files.',
    }, host),
    new SessionCommand({
      name: 'code-caption',
      command: 'caption',
      kind: 'inject',
      descriptionKey: 'cmd.caption',
      hintKey: 'hint.caption',
      persona: personas.caption,
      validate: (rawInput, t) => (String(rawInput ?? '').trim() ? null : t('caption.needsTask')),
      buildText: ({ rawInput, agent, locale }) => {
        const cwd = agent.session?.header?.cwd
        return [
          '# Caption loop',
          '',
          `Task: ${String(rawInput ?? '').trim()}`,
          ...(cwd ? [`Working directory: ${cwd}`, `Ledger directory: ${join(cwd, 'docs', 'caption')}`] : []),
          `Reference directory: ${personas.caption.directory}`,
          '',
          personas.caption.text,
          '',
          outputLanguage(locale),
        ].join('\n')
      },
      receipt: (rawInput, t) => t('caption.installed'),
    }, host),
    new SessionCommand({
      name: 'pua',
      kind: 'inject',
      descriptionKey: 'cmd.pua',
      hintKey: 'hint.pua',
      persona: personas.pua,
      early: (rawInput, t) => (String(rawInput ?? '').trim() === 'list'
        ? { kind: 'success', text: flavorList(t('pua.list')) }
        : null),
      buildText: ({ rawInput, locale }) => buildPua(resolveFlavor(rawInput), personas.pua.text, outputLanguage(locale)),
      receipt: (rawInput, t) => t('pua.installed').replace('{flavor}', resolveFlavor(rawInput).label),
    }, host),
    new SessionCommand({
      name: 'code-status',
      kind: 'local',
      descriptionKey: 'cmd.status',
      run: async ({ agent, t, host: h }) => {
        const entry = h.running.get(agent.id)
        if (entry) return { kind: 'success', text: `${t('status.running')}${entry.label}` }

        const record = await h.journal.read(agent.session?.id ?? agent.id).catch(() => undefined)
        if (!record) return { kind: 'success', text: t('status.none') }
        if (record.state === 'running') return { kind: 'success', text: t('status.interrupted') }
        if (record.state === 'submitted') {
          return { kind: 'success', text: `${t('status.submitted')}${record.scope} · ${record.mode}` }
        }
        return { kind: 'success', text: `${t('status.last')}${record.scope} · ${record.mode}\n\n${record.result}` }
      },
    }, host),
    new SessionCommand({
      name: 'code-cancel',
      kind: 'local',
      descriptionKey: 'cmd.cancel',
      run: ({ agent, t, host: h }) => {
        const entry = h.running.get(agent.id)
        if (!entry) return { kind: 'success', text: t('cancel.none') }
        entry.controller.abort()
        return { kind: 'success', text: t('cancel.done') }
      },
    }, host),
  ]

  for (const command of commands) command.register(ctx)
}
