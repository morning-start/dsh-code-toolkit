import { resolveScope, scopeHasChanges, scopeInstruction, scopeLabel, selectScope, splitFlags } from './selection.js'
import { failureMessage, reportMessage, userMessage, SOURCE_KIND } from './delivery.js'
import { outputLanguage } from './i18n.js'
import { sessionKey } from './identity.js'

/**
 * The receipt names where the task went and what it will do: the current
 * session or an isolated agent, a plan or an edit. A bare "submitted" leaves the
 * person guessing which of the four happened.
 */
function queuedKey(report, isolated) {
  if (report) return isolated ? 'cmd.queuedPlanSub' : 'cmd.queuedPlan'
  return isolated ? 'cmd.queuedSub' : 'cmd.queued'
}

/**
 * One command, one shell.
 *
 * Every command in this plugin talks to the session the same way: settle the
 * handler at once, then either queue a task for the current agent or run an
 * isolated one and deliver its report. What differs per command is only the
 * spec — read-only or writable, scope or inject, structured output or plain
 * text. Keeping that in one class is what makes the commands behave alike.
 */
export class SessionCommand {
  /**
   * @param {object} spec - the command's declarative shape.
   * @param {object} host - shared services owned by `apply()`.
   */
  constructor(spec, host) {
    this.spec = spec
    this.host = host
  }

  /** Register the command against the host command plane. */
  register(ctx) {
    const { spec, host } = this
    const t = (key) => host.translate(host.localeNow(), key)
    const definition = {
      name: spec.name,
      description: t(spec.descriptionKey),
      handler: (invocation) => this.handle(invocation),
    }
    if (spec.hintKey) definition.input = { hint: t(spec.hintKey) }
    ctx.commands.register(definition)
  }

  /** One entry point for every kind: local, inject, task. */
  handle({ agent, rawInput, signal }) {
    const { host, spec } = this
    const locale = host.localeNow()
    const t = (key) => host.translate(locale, key)

    if (spec.kind === 'local') return spec.run({ agent, rawInput, t, host })
    if (spec.kind === 'inject') return this.inject(agent, rawInput, locale, t)
    return this.task(agent, rawInput, signal, locale, t)
  }

  /** Put text into the session: caption's protocol, pua's flavor. */
  async inject(agent, rawInput, locale, t) {
    const { spec, host } = this
    if (spec.validate) {
      const failure = spec.validate(rawInput, t)
      if (failure) return { kind: 'error', text: failure }
    }
    if (spec.early) {
      const result = spec.early(rawInput, t)
      if (result) return result
    }
    if (typeof agent?.steer !== 'function') return { kind: 'error', text: t('error.noSteer') }

    // A protocol is long; injecting it twice in one session doubles the context
    // and gives the agent two copies to disagree with. Only the task is new.
    const sessionId = sessionKey(agent)
    const previous = sessionId ? await host.journal.read(sessionId).catch(() => undefined) : undefined
    const installed = previous?.command === spec.command && previous?.state === 'installed'

    // `steer` takes a complete UserMessage, not a partial `{ content, source }`:
    // the host writes the message into a `user/message` session event as-is, and
    // a message without its own `id` and `role` fails session-log validation on
    // the next load. Build it the same way every other delivery does.
    await agent.steer(userMessage(spec.buildText({ rawInput, agent, locale, host, installed })))

    if (sessionId) {
      await host.journal
        .write(sessionId, {
          state: 'installed',
          command: spec.command,
          at: new Date().toISOString(),
        })
        .catch(() => undefined)
    }

    return {
      kind: 'success',
      text: installed ? spec.receipt(rawInput, t, true, agent) : spec.receipt(rawInput, t, false, agent),
    }
  }

  /** Scope-based task: inline by default, isolated with `sub`. */
  task(agent, rawInput, signal, locale, t) {
    const { sub, report, rest } = splitFlags(rawInput)
    if (!agent.session?.header?.cwd) return { kind: 'error', text: t('error.noCwd') }
    if (typeof agent?.followup !== 'function') return { kind: 'error', text: t('error.noFollowup') }
    return sub
      ? this.startIsolated(agent, rest, signal, locale, t, report)
      : this.startInline(agent, rest, signal, locale, t, report)
  }

  /** Queue the task for the current agent and settle immediately. */
  startInline(agent, rawInput, signal, locale, t, report) {
    const { host } = this
    const controller = new AbortController()
    const combined = AbortSignal.any([signal, controller.signal])
    const sessionId = sessionKey(agent)
    const language = outputLanguage(locale)
    const chinese = String(locale).startsWith('zh')

    void this.prepare(agent, rawInput, combined, locale, t, sessionId, report)
      .then(
        (task) => {
          if (combined.aborted) return
          host.deliver(agent, userMessage(task))
        },
        (error) => {
          if (combined.aborted) return
          const detail = error instanceof Error ? error.message : String(error)
          host.deliver(agent, failureMessage(detail, language, chinese))
        },
      )

    return { kind: 'success', text: t(queuedKey(report, false)).replace('{scope}', '…') }
  }

  /** Run the isolated agent and deliver its report as a message. */
  startIsolated(agent, rawInput, signal, locale, t, report) {
    const { host, spec } = this
    // The single-flight slot and the journal record are keyed by the same
    // identity: one key per session, so cancellation and status find the run
    // that registered it. Without one there is nothing to key on, and inventing
    // a shared key would let every unidentified session crowd into one slot.
    const key = sessionKey(agent)
    if (!key) return { kind: 'error', text: t('error.noIdentity') }
    const stale = host.running.get(key)
    // A run can hang on something outside its own control — an approval nobody
    // answers, a child that never reports. Past the limit the slot is released
    // so the next command is not blocked forever.
    if (stale && Date.now() - stale.startedAt < host.runTimeoutMs) {
      return { kind: 'error', text: t('error.busy') }
    }
    if (stale) {
      stale.controller.abort()
      host.running.delete(key)
    }

    const controller = new AbortController()
    const combined = AbortSignal.any([signal, controller.signal])
    host.running.set(key, { controller, label: host.translate(locale, spec.descriptionKey), startedAt: Date.now() })
    // The journal record is keyed by the same identity as the slot: one key per
    // session, so a status read and a cancellation both find what the run wrote.
    const sessionId = key
    const language = outputLanguage(locale)
    const chinese = String(locale).startsWith('zh')
    // The receipt is resolved before the child starts, so it can name the scope
    // the run actually took; a failure to resolve it is delivered as a message.
    const receipt = this.resolveTask(agent, rawInput, combined, locale, t, sessionId, report, false)

    void receipt
      .then((resolved) => this.execute(agent, resolved, combined, locale, t, sessionId, report))
      .then(
        (text) => {
          if (combined.aborted) return
          host.deliver(agent, reportMessage(text, language, chinese))
        },
        (error) => {
          if (combined.aborted) return
          const detail = error instanceof Error ? error.message : String(error)
          host.deliver(agent, failureMessage(detail, language, chinese))
        },
      )
      .finally(() => host.running.delete(key))

    return receipt.then((resolved) => ({ kind: 'success', text: resolved.receipt }))
  }

  /**
   * The plan the person approved: the last finished dry-run report for the same
   * command and scope. Undefined when there is none, or when it is too old to
   * still describe the tree.
   */
  async approvedPlan(sessionId, scope) {
    const { host, spec } = this
    const record = await host.journal.read(sessionId).catch(() => undefined)
    if (!record || record.state !== 'finished' || record.command !== spec.command) return undefined
    if (record.mode !== 'dry-run' || record.scope !== scope) return undefined
    if (typeof record.result !== 'string' || !record.result.trim()) return undefined
    const age = Date.now() - Date.parse(record.at ?? '')
    if (!Number.isFinite(age) || age > host.planMaxAgeMs) return undefined
    return record.result
  }

  /**
   * Resolve the scope and assemble the task text.
   *
   * Both delivery paths need the same thing — a concrete scope, a mode, the
   * approved plan, the prompt — and differ only in what they do with it. Keeping
   * the resolution here means the two paths cannot drift apart.
   */
  async resolveTask(agent, rawInput, combined, locale, t, sessionId, report, inline) {
    const { host, spec } = this
    const cwd = agent.session?.header?.cwd
    if (!cwd) throw new Error(t('error.noCwd'))

    const { scope: symbolic } = await selectScope(host.ctx, agent, rawInput, combined, t, spec.defaultScope ?? 'project')
    if (!symbolic) throw new Error(t('error.noScope'))
    const scope = await resolveScope(symbolic, { cwd, signal: combined })
    if (!(await scopeHasChanges(scope, { cwd, signal: combined }))) throw new Error(t('error.emptyScope'))

    const mode = spec.forceDryRun || report ? 'dry-run' : 'apply'
    // An apply run that follows an approved plan executes that plan; re-deriving
    // it would let the two runs disagree about what was approved.
    const plan = mode === 'apply' && spec.followsPlan
      ? await this.approvedPlan(sessionId, scopeLabel(scope))
      : undefined
    const prompt = await this.buildPrompt({ scope, mode, cwd, locale, signal: combined, inline, plan })
    // The default scope is decided from the tree, so the receipt has to say
    // which one it landed on — otherwise "current branch" hides whether the
    // uncommitted work or the committed work is being looked at.
    const receipt = t(queuedKey(report, !inline)).replace('{scope}', scopeLabel(scope))

    return { scope, mode, prompt, receipt }
  }

  /**
   * Write one journal record. A run with no usable identity has no record to
   * write — the task still runs, but nothing to key it to is recorded.
   */
  async record(host, sessionId, record) {
    if (!sessionId) return
    await host.journal.write(sessionId, record).catch(() => undefined)
  }

  /** Resolve the scope and assemble the task text (shared by both paths). */
  async prepare(agent, rawInput, combined, locale, t, sessionId, report) {
    const { host, spec } = this
    const { scope, mode, prompt } = await this.resolveTask(agent, rawInput, combined, locale, t, sessionId, report, true)

    await this.record(host, sessionId, {
      state: 'submitted',
      command: spec.command,
      scope: scopeLabel(scope),
      mode,
      at: new Date().toISOString(),
    })

    return prompt
  }

  /** The isolated run: same preparation, then the child, then the report text. */
  async execute(agent, { scope, mode, prompt }, combined, locale, t, sessionId) {
    const { host, spec } = this

    await this.record(host, sessionId, {
      state: 'running',
      command: spec.command,
      scope: scopeLabel(scope),
      mode,
      at: new Date().toISOString(),
    })

    const raw = await host.runIsolatedAgent(agent, {
      persona: `${spec.persona.text}\n\n${outputLanguage(locale)}`,
      prompt,
      label: host.translate(locale, spec.descriptionKey),
      signal: combined,
      model: spec.model,
      t,
    })

    const body = spec.structured ? host.renderReport(host.parseReport(raw), t) : raw
    const text = [`> ${scopeLabel(scope)} · ${mode}`, '', body].join('\n')

    await this.record(host, sessionId, {
      state: 'finished',
      command: spec.command,
      scope: scopeLabel(scope),
      mode,
      result: text,
      at: new Date().toISOString(),
    })

    return text
  }

  /** The task text handed to either the current agent or the child. */
  async buildPrompt({ scope, mode, cwd, locale, signal, inline, plan }) {
    const { spec } = this
    const chinese = String(locale).startsWith('zh')
    const modeLine = mode === 'dry-run'
      ? (chinese ? '只出计划，不要改任何文件。' : (spec.dryRunText ?? 'Report only. Change no files.'))
      : (chinese
        ? '按计划修改，并验证行为不变；验证不通过就回退那一处改动并如实报告。'
        : 'Apply the changes, then verify that behavior is unchanged. If verification fails, revert that change and report it.')
    const delivery = chinese
      ? '你的最终回复会原样发给用户，作为这次任务的结果：写清改了什么、跑了哪条命令、输出是什么、哪些没有验证。'
      : 'Your final reply is delivered to the user as the result: say what changed, which command ran, what it printed, and what stayed unverified.'
    const personaLine = chinese
      ? '先读参考目录下的 AGENT.md，按它的流程与判定标准执行。'
      : 'Read AGENT.md in the reference directory first and follow its process and bar.'
    const outputLine = inline && spec.structured
      ? (chinese
        ? '这次在会话内执行：直接写给人看的 Markdown 报告，不要输出 JSON 信封。'
        : 'This run is in-session: write the report for a human in Markdown, not the JSON envelope.')
      : ''

    const planLine = plan
      ? (chinese
        ? '上一次的报告已由人看过并批准，下面就是那份计划：按它执行，不要重新分析、不要自己改方案。发现计划里有错或已经过期，停下来说明，不要擅自换方案。'
        : 'The previous report was reviewed and approved by the person; it is below. Execute that plan — do not re-derive it and do not substitute your own. If the plan is wrong or stale, stop and say so instead of changing course.')
      : ''

    return [
      chinese ? `工作目录：${cwd}` : `Working directory: ${cwd}`,
      chinese ? `参考目录：${spec.persona.directory}` : `Reference directory: ${spec.persona.directory}`,
      personaLine,
      '',
      await scopeInstruction(scope, { cwd, signal }),
      '',
      chinese ? `模式：${mode}。` : `Mode: ${mode}.`,
      modeLine,
      ...(planLine ? ['', planLine, '', '---', plan, '---'] : []),
      ...(outputLine ? ['', outputLine] : []),
      '',
      delivery,
      '',
      outputLanguage(locale),
    ].join('\n')
  }
}
