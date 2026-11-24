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

/** The report is delivered as a task the model must relay, not re-do. */
export function reportMessage(report, language) {
  return userMessage(
    [
      'Here is the completed code-toolkit report. Present it to the user verbatim:',
      'do not add, remove, or rewrite findings, and do not start another review.',
      '',
      report,
      '',
      language,
    ].join('\n'),
  )
}

/** A failed run still has to say why, or the user is left with a silent box. */
export function failureMessage(detail, language) {
  return userMessage(
    [
      'The code-toolkit run did not complete. Present this status to the user verbatim',
      'and do not retry it on your own:',
      '',
      detail,
      '',
      language,
    ].join('\n'),
  )
}
