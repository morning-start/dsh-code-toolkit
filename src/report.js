/**
 * Turn what the review agent returned into something the session can render.
 *
 * The agent is asked for one JSON object (Codex's review schema). Models do not
 * always comply: some wrap it in a fence, some add prose, some answer in
 * Markdown. A JSON report gets structured rendering with file links; anything
 * else is passed through unchanged, because a slightly ugly report is worth
 * more than a lost one.
 */

function findingList(value) {
  if (Array.isArray(value)) return value
  return value && typeof value === 'object' ? [value] : []
}

function priorityOf(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) return value
  if (typeof value !== 'string') return null
  const match = /^(?:\[?\s*P\s*)?([0-3])\]?$/i.exec(value.trim())
  return match ? Number(match[1]) : null
}

function linesOf(raw) {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return { start: raw, end: raw }
  if (raw && typeof raw === 'object' && Number.isInteger(raw.start) && Number.isInteger(raw.end)) {
    return { start: raw.start, end: raw.end }
  }
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const [from, to] = raw.split(/\s*[-–]\s*/)
  const start = Number(from)
  const end = Number(to ?? from)
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= 0
    ? { start, end }
    : undefined
}

function textOf(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** Accept Codex's field names, plus the aliases models reach for. */
function decode(raw) {
  const value = JSON.parse(raw)
  if (!value || typeof value !== 'object') return undefined

  const findings = findingList(value.findings).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const title = textOf(item.title)
    const body = textOf(item.body)
    if (!title || !body) return []
    const location = item.code_location && typeof item.code_location === 'object' ? item.code_location : {}
    const lines = linesOf(location.line_range) ?? linesOf(location.line) ?? linesOf(item.line)
    const path =
      textOf(location.absolute_file_path) ||
      textOf(location.file) ||
      textOf(location.path) ||
      textOf(item.file) ||
      textOf(item.path)
    const confidence = typeof item.confidence_score === 'number' ? item.confidence_score : undefined
    return [{
      title,
      body,
      priority: priorityOf(item.priority),
      path,
      start: lines?.start ?? 0,
      end: lines?.end ?? 0,
      ...(confidence === undefined ? {} : { confidence }),
    }]
  })

  const summary = textOf(value.overall_explanation)
  if (!summary && !findings.length) return undefined

  const limitations = Array.isArray(value.limitations)
    ? value.limitations.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : []

  const fixed = Array.isArray(value.fixed)
    ? value.fixed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const title = textOf(item.title)
      if (!title) return []
      return [{
        title,
        file: textOf(item.file),
        change: textOf(item.change),
        verifiedBy: textOf(item.verified_by),
      }]
    })
    : []

  return {
    findings,
    fixed,
    summary,
    limitations,
    format: 'structured',
    ...(typeof value.overall_correctness === 'string' ? { correctness: value.overall_correctness } : {}),
  }
}

/**
 * Walk the text and return the JSON objects that look like a report.
 * Braces inside strings (e.g. `src/{a,b}` in an explanation) must not confuse
 * the scanner, otherwise one brace in prose hides the report behind it.
 */
function objectsIn(raw) {
  const found = []
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '{') continue
    const slice = objectAt(raw, i)
    if (!slice) continue
    if (slice.includes('"findings"') && slice.includes('"overall_')) found.push(slice)
    i += slice.length - 1
  }
  return found
}

function objectAt(raw, start) {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return undefined
}

/** Parse a review reply into either a structured report or a text fallback. */
export function parseReport(raw) {
  const candidates = objectsIn(raw)
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const report = decode(candidates[i])
      if (report) return report
    } catch {
      /* field types wrong — try the next candidate */
    }
  }
  return { findings: [], summary: raw.trim(), limitations: [], format: 'text' }
}

function fileLink(path, start, end) {
  const range = start || end ? `:${start}–${end}` : ''
  const destination = encodeURI(path.replaceAll('\\', '/'))
    .replaceAll('?', '%3F')
    .replaceAll('#', '%23')
    .replaceAll(')', '%29')
  const fragment = start || end ? `#L${start}${end !== start ? `-L${end}` : ''}` : ''
  return `[${`${path}${range}`.replaceAll(']', '\\]')}](${destination}${fragment})`
}

/** A finding as its own Markdown section: tag, location, body. */
function renderFinding(finding) {
  const tagged = /^\[P[0-3]\]/.test(finding.title) || finding.priority === null
    ? finding.title
    : `[P${finding.priority}] ${finding.title}`
  const location = finding.path ? fileLink(finding.path, finding.start, finding.end) : ''
  return [`### ${tagged}`, location, finding.body].filter(Boolean).join('\n\n')
}

/** A fix the reviewer made: what changed, where, and how it was verified. */
function renderFix(fix, t) {
  const location = fix.file ? fileLink(fix.file, 0, 0) : ''
  const verified = fix.verifiedBy ? `${t('report.verifiedBy')}${fix.verifiedBy}` : ''
  return [`### ${fix.title}`, location, fix.change, verified].filter(Boolean).join('\n\n')
}

/**
 * Render a parsed report as Markdown. `t` translates the few chrome labels;
 * finding text is never translated — it is the agent's own words.
 */
export function renderReport(report, t) {
  if (report.format === 'text') return report.summary

  const limits = report.limitations.map((item) => `- ${t('report.limitation')}${item}`)
  const empty = !report.findings.length ? t('report.noFindings') : ''
  const fixed = report.fixed ?? []

  return [
    report.summary,
    report.correctness ? `${t('report.verdict')}${report.correctness}` : '',
    empty,
    ...report.findings.map(renderFinding),
    fixed.length ? `## ${t('report.fixed')}\n\n${fixed.map((fix) => renderFix(fix, t)).join('\n\n')}` : '',
    limits.length ? limits.join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}
