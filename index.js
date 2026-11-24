import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { outputLanguage, readHostLocale, resolveLocale, translate } from './src/i18n.js'
import { Journal } from './src/journal.js'
import { parseReport, renderReport } from './src/report.js'
import { scopeInstruction, scopeLabel, selectScope, confirmApply } from './src/selection.js'
import { runIsolatedAgent } from './src/runtime.js'
import { reportMessage, failureMessage } from './src/delivery.js'
import { buildPua, flavorList, resolveFlavor } from './src/pua.js'

export const name = 'morning-start-code-toolkit'
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
  const chinese = String(locale).startsWith('zh')
  const modeLine = mode === 'dry-run'
    ? (chinese ? '只出计划，不要改任何文件。' : dryRunText)
    : (chinese
      ? '按计划修改，并验证行为不变；验证不通过就回退那一处改动并如实报告。'
      : 'Apply the changes, then verify that behavior is unchanged. If verification fails, revert that change and report it.')
  const delivery = chinese
    ? '你的最终回复会原样发给用户，作为这次任务的结果：写清改了什么、跑了哪条命令、输出是什么、哪些没有验证。'
    : 'Your final reply is delivered to the user as the result: say what changed, which command ran, what it printed, and what stayed unverified.'

  return [
    chinese ? `工作目录：${cwd}` : `Working directory: ${cwd}`,
    chinese ? `参考目录：${persona.directory}` : `Reference directory: ${persona.directory}`,
    '',
    await scopeInstruction(scope, { cwd, signal }),
    '',
    chinese ? `模式：${mode}。` : `Mode: ${mode}.`,
    modeLine,
    '',
    delivery,
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
  const captionPersona = loadPersona('caption')
  const puaPersona = loadPersona('pua')

  /** agentId -> { controller, label, startedAt } */
  const running = new Map()

  ctx.effect(() => () => {
    for (const entry of running.values()) entry.controller.abort()
    running.clear()
  })

  function localeNow() {
    return forcedLocale ?? readHostLocale(ctx, fallbackLocale)
  }

  /** Queue a message for the current session; a disposed session is not an error. */
  function deliver(agent, message) {
    try {
      agent.followup(message)
    } catch {
      /* session disposed or unavailable */
    }
  }

  /**
   * The background half: pick a scope, run the isolated agent, render the report.
   * It resolves to the report text and throws on any failure — delivery belongs
   * to `start`, not here.
   */
  async function execute(agent, rawInput, combined, options, { sessionId, locale, t }) {
    const cwd = agent.session?.header?.cwd
    if (!cwd) throw new Error(t('error.noCwd'))

    const { scope, apply: fromArgs } = await selectScope(ctx, agent, rawInput, combined, t)
    if (!scope) throw new Error(t('error.noScope'))

    const wantsApply = fromArgs || (options.askApply === true && await confirmApply(ctx, agent, combined, t))
    const mode = options.forceDryRun || !wantsApply ? 'dry-run' : 'apply'
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

    return text
  }

  /**
   * Start a run and settle the command immediately.
   *
   * The composer stays read-only from Enter until the handler settles, so a
   * handler that awaits the whole subagent run leaves the draft sitting in the
   * box. The run continues in the background and its report is delivered as a
   * queued user message — the same shape `dsh-code-review` and `dsh-simplify`
   * use. `/code-status` still reads the journal, `/code-cancel` still aborts.
   */
  function start(agent, rawInput, signal, options) {
    const key = agent.id
    const locale = localeNow()
    const t = (name) => translate(locale, name)
    if (running.has(key)) return { kind: 'error', text: t('error.busy') }
    if (!agent.session?.header?.cwd) return { kind: 'error', text: t('error.noCwd') }

    const controller = new AbortController()
    const combined = AbortSignal.any([signal, controller.signal])
    running.set(key, { controller, label: options.label, startedAt: Date.now() })
    const sessionId = agent.session?.id ?? agent.id
    const language = outputLanguage(locale)
    const chinese = String(locale).startsWith('zh')

    void execute(agent, rawInput, combined, options, { sessionId, locale, t })
      .then(
        (text) => {
          if (combined.aborted) return
          deliver(agent, reportMessage(text, language, chinese))
        },
        (error) => {
          if (combined.aborted) return
          const detail = error instanceof Error ? error.message : String(error)
          deliver(agent, failureMessage(detail, language, chinese))
        },
      )
      .finally(() => running.delete(key))

    return { kind: 'success', text: t('cmd.queued') }
  }

  // These three declare `input` on purpose: a command without it is executed the
  // moment it is picked from the `/` menu (Tab included), so there is no way to
  // insert the token and keep typing. The handler settles immediately, so the
  // composer clears at once; the report arrives later as a queued message.
  ctx.commands.register({
    name: 'code-simplify',
    description: translate(localeNow(), 'cmd.simplify'),
    input: { hint: translate(localeNow(), 'hint.scope') },
    handler({ agent, rawInput, signal }) {
      return start(agent, rawInput, signal, {
        command: 'simplify',
        persona: simplifyPersona,
        label: translate(localeNow(), 'cmd.simplify'),
        model: config.simplifyModel,
        forceDryRun: false,
        askApply: true,
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
      return start(agent, rawInput, signal, {
        command: 'scrub',
        persona: scrubPersona,
        label: translate(localeNow(), 'cmd.scrub'),
        model: config.scrubModel,
        forceDryRun: false,
        askApply: true,
        structured: true,
        dryRunText: 'Report only. Change no files, and never reproduce a secret in the report.',
      })
    },
  })

  ctx.commands.register({
    name: 'code-caption',
    description: translate(localeNow(), 'cmd.caption'),
    input: { hint: translate(localeNow(), 'hint.caption') },
    async handler({ agent, rawInput }) {
      const locale = localeNow()
      const t = (key) => translate(locale, key)
      const task = String(rawInput ?? '').trim()
      if (!task) return { kind: 'error', text: t('caption.needsTask') }
      if (typeof agent?.steer !== 'function') return { kind: 'error', text: t('error.noSteer') }

      const cwd = agent.session?.header?.cwd
      const text = [
        '# Caption loop',
        '',
        `Task: ${task}`,
        ...(cwd ? [`Working directory: ${cwd}`, `Ledger directory: ${join(cwd, 'docs', 'caption')}`] : []),
        `Reference directory: ${captionPersona.directory}`,
        '',
        captionPersona.text,
        '',
        outputLanguage(locale),
      ].join('\n')

      // The command plane does not submit a model message, so the protocol has
      // to be steered in: it becomes the next step's ordinary user message.
      await agent.steer({ content: [{ type: 'text', text }], source: { kind: 'user' } })
      return { kind: 'success', text: t('caption.installed') }
    },
  })

  ctx.commands.register({
    name: 'code-review',
    description: translate(localeNow(), 'cmd.review'),
    input: { hint: translate(localeNow(), 'hint.scope') },
    handler({ agent, rawInput, signal }) {
      return start(agent, rawInput, signal, {
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
    name: 'pua',
    description: translate(localeNow(), 'cmd.pua'),
    input: { hint: translate(localeNow(), 'hint.pua') },
    async handler({ agent, rawInput }) {
      const locale = localeNow()
      const t = (key) => translate(locale, key)
      const argument = String(rawInput ?? '').trim()
      if (argument === 'list') return { kind: 'success', text: flavorList(t('pua.list')) }
      if (typeof agent?.steer !== 'function') return { kind: 'error', text: t('error.noSteer') }

      const flavor = resolveFlavor(argument)
      await agent.steer({
        content: [{ type: 'text', text: buildPua(flavor, puaPersona.text, outputLanguage(locale)) }],
        source: { kind: 'user' },
      })
      return { kind: 'success', text: t('pua.installed').replace('{flavor}', flavor.label) }
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
