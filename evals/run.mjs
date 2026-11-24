#!/usr/bin/env node
/**
 * Deterministic eval suite.
 *
 * Everything here is a property of the plugin's own files and code: prompt-tree
 * integrity, the report parser, the renderer, prompt assembly, package
 * metadata. No model is called, so it runs in a second and can gate a commit.
 *
 * The model's quality is measured by `evals/ACCEPTANCE.md` instead — see
 * `score.mjs` for the scoring half.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseReport, renderReport } from '../src/report.js'
import { scopeInstruction, scopeLabel, parseArgs, mergeBase, confirmApply } from '../src/selection.js'
import { resolveLocale, translate, outputLanguage } from '../src/i18n.js'
import { apply, name as pluginName } from '../index.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const verbose = process.argv.includes('--verbose')

let passed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed += 1
    if (verbose) console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
    console.log(`FAIL ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    passed += 1
    if (verbose) console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
    console.log(`FAIL ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

const read = (relative) => readFileSync(join(ROOT, relative), 'utf8')
const exists = (relative) => existsSync(join(ROOT, relative))
const t = (key) => translate('en', key)

// ---------------------------------------------------------------------------
// A. package metadata
// ---------------------------------------------------------------------------

test('package.json is valid and declares the bundle patch', () => {
  const pkg = JSON.parse(read('package.json'))
  assertEqual(pkg.type, 'module', 'type')
  assertEqual(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'dsh.bundle.patch')
  assert(Boolean(pkg.engines?.dsh), 'engines.dsh is required for a bundle')
  assert(pkg.files.includes('agents'), 'files must ship agents/')
  assert(!pkg.files.includes('prompts'), 'the flat prompts/ directory is gone')
})

test('every declared file and export exists', () => {
  const pkg = JSON.parse(read('package.json'))
  for (const entry of pkg.files) {
    if (entry.includes('*')) continue
    assert(exists(entry), `files entry missing: ${entry}`)
  }
  for (const target of Object.values(pkg.exports)) {
    if (typeof target !== 'string' || target.includes('*')) continue
    assert(exists(target), `export target missing: ${target}`)
  }
  for (const locale of ['zh', 'en']) {
    assert(exists(`locale/${locale}.json`), `locale/${locale}.json missing`)
  }
})

test('bundle patch inserts this package', () => {
  const pkg = JSON.parse(read('package.json'))
  const patch = read('cordis.patch.yml')
  assert(/^-\s+insert:/m.test(patch), 'patch needs an insert block')
  assert(patch.includes(pkg.name), `patch must name ${pkg.name}`)
})

test('plugin id agrees across package.json, the patch, and index.js', () => {
  const pkg = JSON.parse(read('package.json'))
  const patch = read('cordis.patch.yml')
  const patchName = patch.match(/^\s*name:\s*'([^']+)'/m)?.[1]
  const patchId = patch.match(/^\s*-\s+id:\s*(\S+)/m)?.[1]
  assertEqual(patchName, pkg.name, 'patch name must be the package name')
  assertEqual(patchId, pluginName, 'patch id must equal the exported module name')
})

test('the old package name survives only in the changelog', () => {
  const stale = /code-quality|代码质量/
  const offenders = []
  const scan = (relative) => {
    if (stale.test(read(relative))) offenders.push(relative)
  }
  for (const file of ['package.json', 'cordis.patch.yml', 'README.md', 'AGENTS.md', 'index.js']) scan(file)
  for (const dir of ['src', 'agents', 'docs', 'locale']) {
    for (const entry of readdirSync(join(ROOT, dir), { recursive: true })) {
      const relative = join(dir, entry).replaceAll('\\', '/')
      if (statSync(join(ROOT, relative)).isFile()) scan(relative)
    }
  }
  assert(offenders.length === 0, `still mentions the old name: ${offenders.join(', ')}`)
})

test('locale metadata points at an existing detail document', () => {
  for (const locale of ['zh', 'en']) {
    const data = JSON.parse(read(`locale/${locale}.json`))
    assert(Boolean(data.meta?.title), `${locale}: title`)
    assert(Boolean(data.meta?.description), `${locale}: description`)
    assert(exists(data.meta.detail), `${locale}: detail ${data.meta.detail}`)
  }
})

test('icon is self-contained svg', () => {
  const icon = read('icon.svg')
  assert(icon.includes('<svg') && icon.includes('</svg>'), 'icon must be svg')
  assert(/viewBox="[^"]+"/.test(icon), 'icon needs a viewBox')
  assert(!icon.includes('<script'), 'icon must not script')
  assert(!/https?:\/\//.test(icon.replace(/xmlns="[^"]*"/g, '')), 'icon must not fetch remote assets')
})

// ---------------------------------------------------------------------------
// B. prompt tree
// ---------------------------------------------------------------------------

const ROLES = {
  review: ['Resolve the scope', 'The eight gates', 'Priorities', 'Output', 'Reference files'],
  simplify: ['Three iron rules', 'Six operations', 'Anti-patterns', 'Verification', 'Reference files'],
  caption: ['The loop', 'Read the ledger first', 'Verify', 'Record one caption entry', 'Reference files'],
}

for (const [role, sections] of Object.entries(ROLES)) {
  test(`${role}: AGENT.md exists and stays small`, () => {
    const text = read(`agents/${role}/AGENT.md`)
    assert(text.length > 800, 'persona is suspiciously short')
    assert(text.length < 12000, `persona is ${text.length} chars; move detail into references/`)
    for (const section of sections) {
      assert(text.includes(section), `missing section: ${section}`)
    }
  })

  test(`${role}: every referenced file exists`, () => {
    const text = read(`agents/${role}/AGENT.md`)
    const refs = [...text.matchAll(/`((?:references|examples)\/[^`]+\.md)`/g)].map((match) => match[1])
    assert(refs.length > 0, 'the persona must point at reference files')
    for (const ref of new Set(refs)) {
      assert(exists(`agents/${role}/${ref}`), `referenced but missing: ${ref}`)
    }
  })

  test(`${role}: every shipped reference is reachable from the persona`, () => {
    const text = read(`agents/${role}/AGENT.md`)
    for (const directory of ['references', 'examples']) {
      const path = join(ROOT, 'agents', role, directory)
      if (!existsSync(path)) continue
      for (const file of readdirSync(path).filter((name) => name.endsWith('.md'))) {
        assert(
          text.includes(`${directory}/${file}`),
          `${directory}/${file} exists but no instruction says when to read it`,
        )
      }
    }
  })

  test(`${role}: references have a title and are substantial`, () => {
    const path = join(ROOT, 'agents', role, 'references')
    for (const file of readdirSync(path).filter((name) => name.endsWith('.md'))) {
      const text = readFileSync(join(path, file), 'utf8')
      assert(/^#\s+\S/m.test(text), `${file}: needs a level-1 heading`)
      assert(text.length > 400, `${file}: too thin (${text.length} chars)`)
    }
  })
}

test('sourced material names its source', () => {
  for (const file of ['agents/review/references/rubric.md', 'agents/simplify/references/anti-patterns.md']) {
    const text = read(file)
    assert(/Source:/.test(text), `${file} must state where its material comes from`)
    assert(/Apache-2\.0|claude-plugins-official|Codex/.test(text), `${file} must name the upstream`)
  }
})

// ---------------------------------------------------------------------------
// C. report parser
// ---------------------------------------------------------------------------

const bareReport = JSON.stringify({
  findings: [
    {
      title: '[P1] Guard the header',
      body: '`header.cwd` throws when the caller omits the header.',
      confidence_score: 0.8,
      priority: 1,
      code_location: { absolute_file_path: 'E:\\app\\src\\server.js', line_range: { start: 3, end: 4 } },
    },
  ],
  overall_correctness: 'patch is incorrect',
  overall_explanation: 'The change drops a default parameter.',
  overall_confidence_score: 0.8,
})

test('parser: bare JSON report', () => {
  const report = parseReport(bareReport)
  assertEqual(report.format, 'structured', 'format')
  assertEqual(report.findings.length, 1, 'findings')
  assertEqual(report.findings[0].priority, 1, 'priority')
  assertEqual(report.findings[0].start, 3, 'start')
  assertEqual(report.findings[0].end, 4, 'end')
  assertEqual(report.correctness, 'patch is incorrect', 'correctness')
})

test('parser: JSON wrapped in a fence with prose around it', () => {
  const raw = `Here is my review.\n\n\`\`\`json\n${bareReport}\n\`\`\`\n\nLet me know.`
  const report = parseReport(raw)
  assertEqual(report.format, 'structured', 'format')
  assertEqual(report.findings.length, 1, 'findings')
})

test('parser: braces inside prose do not hide the report', () => {
  const raw = `I looked at src/{a,b} and the config {draft} object.\n${bareReport}`
  const report = parseReport(raw)
  assertEqual(report.format, 'structured', 'format')
  assertEqual(report.findings.length, 1, 'findings')
})

test('parser: tolerates P2 and a string line range', () => {
  const raw = JSON.stringify({
    findings: [{ title: 'Drift', body: 'Two copies.', priority: 'P2', file: 'src/a.js', line: '12-14' }],
    overall_explanation: 'Minor.',
  })
  const report = parseReport(raw)
  assertEqual(report.findings[0].priority, 2, 'priority from "P2"')
  assertEqual(report.findings[0].start, 12, 'start from string range')
  assertEqual(report.findings[0].end, 14, 'end from string range')
  assertEqual(report.findings[0].path, 'src/a.js', 'path alias')
})

test('parser: a finding without a location is kept but renders without a link', () => {
  const raw = JSON.stringify({
    findings: [{ title: 'Vague', body: 'Something feels off.' }],
    overall_explanation: 'Not much to say.',
  })
  const report = parseReport(raw)
  assertEqual(report.format, 'structured', 'format')
  assertEqual(report.findings.length, 1, 'a finding with no location is still a finding')
  assertEqual(report.findings[0].path, '', 'path')
  const text = renderReport(report, t)
  assert(!text.includes(']('), 'renders without a link')
  assert(text.includes('Vague'), 'title survives')
})

test('parser: picks the last valid object when several appear', () => {
  const first = JSON.stringify({ findings: [], overall_explanation: 'draft', overall_correctness: 'x' })
  const second = JSON.stringify({ findings: [], overall_explanation: 'final', overall_correctness: 'y' })
  const report = parseReport(`${first}\n${second}`)
  assertEqual(report.summary, 'final', 'summary')
})

test('parser: malformed input falls back to text', () => {
  const raw = '# Review\n\nLooks fine to me.'
  const report = parseReport(raw)
  assertEqual(report.format, 'text', 'format')
  assertEqual(report.summary, raw, 'summary')
})

test('renderer: adds a priority tag and a line-anchored file link', () => {
  const text = renderReport(parseReport(bareReport), t)
  assert(text.includes('[P1] Guard the header'), 'priority tag')
  assert(/\]\(E:%5Capp%5Csrc%5Cserver\.js#L3-L4\)/.test(text) || text.includes('#L3-L4'), 'line fragment')
  assert(text.includes('server.js:3–4'), 'range label')
})

test('renderer: does not double-tag a title that already has one', () => {
  const text = renderReport(parseReport(bareReport), t)
  assert(!text.includes('[P1] [P1]'), 'double tag')
})

test('renderer: text fallback is passed through unchanged', () => {
  const raw = '## Findings\n\nNothing.'
  assertEqual(renderReport(parseReport(raw), t), raw, 'passthrough')
})

// ---------------------------------------------------------------------------
// D. prompt assembly
// ---------------------------------------------------------------------------

await testAsync('scope: working tree', async () => {
  const text = await scopeInstruction({ mode: 'worktree' })
  assert(text.includes('git status --short'), 'mentions git status')
  assert(text.includes('git diff HEAD'), 'mentions git diff')
})

await testAsync('scope: commit carries the ref and title', async () => {
  const text = await scopeInstruction({ mode: 'commit', ref: 'abc123', title: 'fix: guard' })
  assert(text.includes('abc123'), 'ref')
  assert(text.includes('fix: guard'), 'title')
})

await testAsync('scope: files lists every path', async () => {
  const text = await scopeInstruction({ mode: 'files', paths: ['src/a.js', 'src/b.js'] })
  assert(text.includes('`src/a.js`') && text.includes('`src/b.js`'), 'paths')
})

await testAsync('scope: custom instructions are passed verbatim', async () => {
  const text = await scopeInstruction({ mode: 'instructions', text: 'only the auth module' })
  assert(text.includes('only the auth module'), 'instructions')
})

await testAsync('scope: base without a repository still gives a usable instruction', async () => {
  const text = await scopeInstruction({ mode: 'base', ref: 'main' })
  assert(text.includes('merge-base'), 'fallback mentions merge-base')
  assert(text.includes('main'), 'names the base ref')
})

test('scope labels stay short', () => {
  assertEqual(scopeLabel({ mode: 'commit', ref: '0123456789abcdef' }), 'commit 0123456789', 'commit label')
  assertEqual(scopeLabel({ mode: 'worktree' }), 'working tree vs HEAD', 'worktree label')
  const long = scopeLabel({ mode: 'instructions', text: 'x'.repeat(200) })
  assert(long.length <= 61, `label is ${long.length} chars`)
})

test('argument parsing keeps --apply out of the scope text', () => {
  const parsed = parseArgs('--files src/a.js,src/b.js --apply')
  assertEqual(parsed.apply, true, 'apply')
  assertEqual(parsed.scope.mode, 'files', 'mode')
  assertEqual(parsed.scope.paths.length, 2, 'paths')
  const custom = parseArgs('look at the auth flow --apply')
  assertEqual(custom.scope.mode, 'instructions', 'custom mode')
  assertEqual(custom.scope.text, 'look at the auth flow', 'custom text')
})

// ---------------------------------------------------------------------------
// E. locale
// ---------------------------------------------------------------------------

test('locale: eight official languages resolve, unknown falls back to English', () => {
  assertEqual(resolveLocale('zh-CN'), 'zh', 'zh-CN')
  assertEqual(resolveLocale('ja'), 'ja', 'ja')
  assertEqual(resolveLocale('pt-BR'), 'pt', 'pt-BR')
  assertEqual(resolveLocale('it-IT'), 'en', 'unknown tag')
  assertEqual(resolveLocale(''), 'zh', 'empty')
})

test('locale: every key used by index.js is translated', () => {
  const index = read('index.js')
  const keys = [...index.matchAll(/t\('([a-zA-Z.]+)'\)/g)].map((match) => match[1])
  for (const key of new Set(keys)) {
    assert(translate('zh', key) !== key, `zh is missing ${key}`)
    assert(translate('en', key) !== key, `en is missing ${key}`)
  }
})

test('locale: output language names the target', () => {
  assert(outputLanguage('de').includes('German'), 'de')
  assert(outputLanguage('zh').includes('Chinese'), 'zh')
})

// ---------------------------------------------------------------------------
// F. eval cases
// ---------------------------------------------------------------------------

const caseRoot = join(ROOT, 'evals', 'cases')
const cases = readdirSync(caseRoot).filter((name) => statSync(join(caseRoot, name)).isDirectory())

test('there is at least one case per mode', () => {
  const modes = cases.map((name) => JSON.parse(read(`evals/cases/${name}/expected.json`)).mode)
  for (const mode of ['review', 'simplify', 'scrub', 'caption']) {
    assert(modes.includes(mode), `no case with mode "${mode}"`)
  }
})

test('every agent role has an eval case, and every case has a role', () => {
  const roles = readdirSync(join(ROOT, 'agents')).filter((name) =>
    statSync(join(ROOT, 'agents', name)).isDirectory(),
  )
  const modes = new Set(cases.map((name) => JSON.parse(read(`evals/cases/${name}/expected.json`)).mode))
  for (const role of roles) {
    assert(modes.has(role), `agents/${role} ships without any eval case`)
  }
  for (const mode of modes) {
    assert(roles.includes(mode), `eval case uses mode "${mode}" but there is no agents/${mode}`)
  }
})

for (const name of cases) {
  test(`case ${name}: well formed`, () => {
    const dir = join(caseRoot, name)
    assert(existsSync(join(dir, 'README.md')), 'README.md explains the case')
    assert(existsSync(join(dir, 'before')), 'before/ tree')
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
    assert(['review', 'simplify', 'scrub', 'caption'].includes(expected.mode), 'mode')
    if (expected.mode === 'simplify' || expected.mode === 'caption') {
      assert(Array.isArray(expected.requireGroups) && expected.requireGroups.length, 'requireGroups')
    } else {
      assert(Array.isArray(expected.findings), 'findings array')
      for (const finding of expected.findings) {
        assert(typeof finding.file === 'string', 'finding.file')
        assert(Number.isInteger(finding.line), 'finding.line')
        assert(Number.isInteger(finding.priority), 'finding.priority')
      }
      assert(typeof expected.clean === 'boolean', 'clean flag')
      if (expected.mustNotLeak !== undefined) {
        assert(Array.isArray(expected.mustNotLeak), 'mustNotLeak is an array')
        assert(expected.mustNotLeak.every((item) => typeof item === 'string'), 'mustNotLeak entries are strings')
      }
    }
  })
}

// ---------------------------------------------------------------------------
// G. plugin wiring
// ---------------------------------------------------------------------------

test('apply() registers every command against a stub host', () => {
  const registered = []
  const ctx = {
    effect: (fn) => {
      fn()
      return () => {}
    },
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }

  apply(ctx, {})

  const names = registered.map((definition) => definition.name).sort()
  assertEqual(
    names.join(','),
    'code-cancel,code-caption,code-review,code-scrub,code-simplify,code-status',
    'registered commands',
  )
  for (const definition of registered) {
    assert(typeof definition.description === 'string' && definition.description.length > 0, `${definition.name}: description`)
    assert(typeof definition.handler === 'function', `${definition.name}: handler`)
  }
})

test('spawn commands keep their input claim so the menu inserts instead of running', () => {
  const registered = []
  apply({
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }, {})

  // A host command without `input` is executed the moment it is picked from the
  // `/` menu (Tab included): there is no way to insert the token and keep
  // typing. The cost is that the composer stays read-only until the handler
  // settles; that trade-off is deliberate and documented in docs/DETAIL.md.
  for (const name of ['code-review', 'code-simplify', 'code-scrub', 'code-caption']) {
    const definition = registered.find((item) => item.name === name)
    assert(definition !== undefined, `${name} is registered`)
    assert(
      definition.input !== undefined,
      `${name} must declare input — without it the menu executes on pick and Tab cannot insert`,
    )
  }
})

await testAsync('question prompts go through ctx.get, never ctx.userQuestions', async () => {
  // Cordis throws on `ctx.userQuestions` unless the plugin injects it, and the
  // service is optional. A property getter that throws reproduces the real
  // failure: "cannot get property userQuestions without inject".
  const answers = { answers: [{ id: 'code-toolkit-apply', selected: ['Report only'] }] }
  const ctx = {
    get: (name) => (name === 'userQuestions' ? { ask: async () => answers } : undefined),
  }
  Object.defineProperty(ctx, 'userQuestions', {
    get() {
      throw new Error('cannot get property "userQuestions" without inject')
    },
  })
  const strings = {
    'apply.title': 'Rewrite mode',
    'apply.question': 'Report only or rewrite?',
    'apply.plan': 'Report only',
    'apply.plan.desc': 'Change no files',
    'apply.write': 'Rewrite',
    'apply.write.desc': 'Verify after writing',
    'error.noScope': 'no scope',
  }
  const t = (key) => strings[key] ?? key
  assertEqual(await confirmApply(ctx, {}, undefined, t), false, 'the plan-only answer is not apply')
})

test('apply() rejects an invalid config instead of failing later', () => {
  const ctx = {
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: () => {} },
  }
  let threw = false
  try {
    apply(ctx, { reportDirectory: 'relative/dir' })
  } catch {
    threw = true
  }
  assert(threw, 'a relative reportDirectory must be rejected')
})

function captionDefinition() {
  const registered = []
  apply({
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }, {})
  return registered.find((definition) => definition.name === 'code-caption')
}

test('simplify: no gate, no apply, and the plan ranks by value', () => {
  const text = read('agents/simplify/AGENT.md')
  for (const marker of [
    'Value before volume',
    'characterization baseline',
    'do not apply',
    'anchor is unique',
    'Files read in full',
    'behaviour-risk',
  ]) {
    assert(text.includes(marker), `the simplify protocol is missing: ${marker}`)
  }
  const verification = read('agents/simplify/references/verification.md')
  assert(verification.includes('When the project has no tests'), 'verification.md lost the no-suite protocol')
})

test('caption: the protocol carries the loop, not a checklist', () => {
  const text = read('agents/caption/AGENT.md')
  for (const marker of ['Read the ledger first', 'Verify', 'Record one caption entry', 'dead end', 'unverified']) {
    assert(text.includes(marker), `the protocol is missing: ${marker}`)
  }
})

test('caption: dispatch is limited to slices that cannot collide', () => {
  const text = read('agents/caption/AGENT.md')
  for (const marker of [
    'Analysis is read-only',
    'disjoint',
    'exactly one owner',
    'Never run two writers on the same path',
  ]) {
    assert(text.includes(marker), `the dispatch rule is missing: ${marker}`)
  }
  const reference = read('agents/caption/references/dispatch.md')
  for (const marker of ['exclusive', 'shared files', 'Merging']) {
    assert(reference.toLowerCase().includes(marker.toLowerCase()), `dispatch.md is missing: ${marker}`)
  }
})

await testAsync('caption: task and protocol are steered into the session', async () => {
  const definition = captionDefinition()
  const steered = []
  const agent = {
    id: 'a1',
    session: { header: { cwd: 'C:\\work\\demo' } },
    steer: (message) => { steered.push(message) },
  }

  const result = await definition.handler({ agent, rawInput: 'make the suite green' })

  assertEqual(result.kind, 'success', 'kind')
  assertEqual(steered.length, 1, 'exactly one steered message')
  const text = steered[0].content[0].text
  assert(text.includes('make the suite green'), 'carries the task')
  assert(text.includes('Reference directory:'), 'names the reference directory')
  assert(text.includes('Record one caption entry'), 'carries the loop')
  assert(text.includes('caption'), 'names the ledger directory')
})

await testAsync('caption: an empty task is refused before anything is steered', async () => {
  const definition = captionDefinition()
  const steered = []
  const agent = { id: 'a1', session: { header: { cwd: 'C:\\work\\demo' } }, steer: (m) => steered.push(m) }

  const result = await definition.handler({ agent, rawInput: '   ' })

  assertEqual(result.kind, 'error', 'kind')
  assertEqual(steered.length, 0, 'nothing is steered')
})

await testAsync('caption: a host without steer fails loudly', async () => {
  const definition = captionDefinition()
  const agent = { id: 'a1', session: { header: { cwd: 'C:\\work\\demo' } } }

  const result = await definition.handler({ agent, rawInput: 'do the thing' })

  assertEqual(result.kind, 'error', 'kind')
  assert(result.text.length > 0, 'says why it cannot run')
})

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('\nFailures:')
  for (const failure of failures) console.log(`- ${failure.name}: ${failure.message}`)
  process.exit(1)
}
