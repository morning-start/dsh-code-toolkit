import { randomUUID } from 'node:crypto'

/**
 * The plugin's own message source. The host rejects a shared `plugin` kind, so
 * every producer names itself.
 */
export const SOURCE_KIND = 'morning-start-code-toolkit'

/**
 * Build the user message the host queues for the current session.
 *
 * Mirrors `createUserMessage` from `@deepseek-ai/dsh-llm` (`{...input,
 * role:'user', id}`), because a `link:`-installed plugin cannot resolve host
 * packages: its bare imports start from the plugin's real path, not the
 * profile's node_modules.
 */
export function userMessage(text) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: SOURCE_KIND },
  }
}

/**
 * The instruction that wraps a message the model must relay, not re-do.
 * The two callers differ only in that opening sentence.
 */
function relayMessage(lead, body, language) {
  return userMessage([lead, '', body, '', language].join('\n'))
}

/** The report is delivered as a task the model must relay, not re-do. */
export function reportMessage(report, language, chinese = false) {
  const lead = chinese
    ? '下面是这次代码工具箱任务的完成报告。请原样转述给用户：不要增删或改写结论，也不要重新发起审查。'
    : 'Here is the completed code-toolkit report. Present it to the user verbatim:\ndo not add, remove, or rewrite findings, and do not start another review.'
  return relayMessage(lead, report, language)
}

/** A failed run still has to say why, or the user is left with a silent box. */
export function failureMessage(detail, language, chinese = false) {
  const lead = chinese
    ? '这次代码工具箱任务没有完成。请把下面的原因原样转述给用户，不要自行重试：'
    : 'The code-toolkit run did not complete. Present this status to the user verbatim\nand do not retry it on your own:'
  return relayMessage(lead, detail, language)
}
