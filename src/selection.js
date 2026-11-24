import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const GIT_MAX_BUFFER = 8 * 1024 * 1024

/** Run git in a working directory and return trimmed stdout. */
export async function git(cwd, args, signal) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      signal,
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    })
    return stdout.trim()
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    const detail = (error?.stderr || error?.message || String(error)).toString().trim()
    throw new Error(`git ${args.join(' ')} failed: ${detail}`)
  }
}

/** Resolve a ref to a commit, returning undefined when it does not exist. */
async function resolveRef(cwd, ref, signal) {
  try {
    return await git(cwd, ['rev-parse', '--verify', '--end-of-options', ref], signal)
  } catch {
    signal?.throwIfAborted()
    return undefined
  }
}

/**
 * Find the commit a branch comparison should start from.
 *
 * The interesting case is a local base branch that is behind its upstream: the
 * diff a reviewer cares about is against the upstream, not the stale local tip.
 */
export async function mergeBase(cwd, ref, signal) {
  const head = await resolveRef(cwd, 'HEAD', signal)
  let base = await resolveRef(cwd, ref, signal)
  if (!head || !base) return undefined

  const upstream = await resolveRef(cwd, `${ref}@{upstream}`, signal)
  if (upstream) {
    try {
      const counts = (await git(cwd, ['rev-list', '--left-right', '--count', `${base}...${upstream}`], signal))
        .split(/\s+/)
      if (Number(counts[1]) > 0) base = upstream
    } catch {
      /* no upstream to compare against */
    }
  }

  try {
    return await git(cwd, ['merge-base', head, base], signal)
  } catch {
    return undefined
  }
}

/** Parse the raw command line into an explicit scope plus the apply flag. */
export function splitSub(rawInput) {
  const tokens = String(rawInput ?? '').trim().split(/\s+/).filter(Boolean)
  const sub = tokens.some((token) => token.toLowerCase() === 'sub')
  return { sub, rest: tokens.filter((token) => token.toLowerCase() !== 'sub').join(' ') }
}

export function parseArgs(rawInput) {
  const tokens = rawInput.trim().split(/\s+/).filter(Boolean)
  let apply = false
  const rest = []
  for (const token of tokens) {
    if (token === '--apply') {
      apply = true
      continue
    }
    rest.push(token)
  }
  const line = rest.join(' ')
  if (!line) return { scope: null, apply }

  const files = line.match(/^--files\s+(.+)$/)
  if (files) {
    const paths = files[1].split(/[,;]/).map((item) => item.trim()).filter(Boolean)
    if (paths.length) return { scope: { mode: 'files', paths }, apply }
  }
  const base = line.match(/^--base\s+(.+)$/)
  if (base) return { scope: { mode: 'base', ref: base[1].trim() }, apply }
  const commit = line.match(/^--commit\s+(.+)$/)
  if (commit) return { scope: { mode: 'commit', ref: commit[1].trim() }, apply }

  return { scope: { mode: 'instructions', text: line }, apply }
}

async function ask(ctx, agent, question, signal, t) {
  // `ctx.userQuestions` throws unless the plugin declares it in `inject`; the
  // service is optional (headless hosts have no UI), so every access goes
  // through `ctx.get`.
  const questions = ctx.get('userQuestions')
  if (questions === undefined) throw new Error(t('error.noScope'))
  const result = await questions.ask({ agent, signal, questions: [question] })
  const answer = result.answers.find((item) => item.id === question.id)
  if (!answer) throw new Error(t('error.noScope'))
  const value = (answer.custom ?? '').trim() || answer.selected?.[0] || ''
  if (!value) throw new Error(t('error.noScope'))
  return value
}

/**
 * Ask whether this run should rewrite files or only report.
 *
 * The command line no longer carries `--apply`: the composer clears only when
 * the command settles, so a long-running handler must not be claimed, and a
 * claimed command is the only kind that receives arguments.
 */
export async function confirmApply(ctx, agent, signal, t) {
  if (!ctx.get('userQuestions')) return false
  const choice = await ask(ctx, agent, {
    id: 'code-toolkit-apply',
    header: t('apply.title'),
    question: t('apply.question'),
    options: [
      { label: t('apply.plan'), description: t('apply.plan.desc') },
      { label: t('apply.write'), description: t('apply.write.desc') },
    ],
  }, signal, t)
  return choice === t('apply.write')
}

/**
 * Resolve a scope: an explicit line wins, otherwise ask the user.
 * Returns null when the user gave nothing usable.
 */
export async function selectScope(ctx, agent, rawInput, signal, t) {
  const parsed = parseArgs(rawInput)
  if (parsed.scope) return parsed

  const questions = ctx.get('userQuestions')
  if (!questions) return { scope: { mode: 'worktree' }, apply: parsed.apply }

  const choice = await ask(ctx, agent, {
    id: 'code-toolkit-scope',
    header: t('select.scope.title'),
    question: t('select.scope.question'),
    options: [
      { label: t('option.current'), description: t('option.current.desc') },
      { label: t('option.base'), description: t('option.base.desc') },
      { label: t('option.commit'), description: t('option.commit.desc') },
      { label: t('option.custom'), description: t('option.custom.desc') },
    ],
  }, signal, t)

  if (choice === t('option.current')) return { scope: { mode: 'worktree' }, apply: parsed.apply }

  if (choice === t('option.custom')) {
    const text = await ask(ctx, agent, {
      id: 'code-toolkit-instructions',
      question: t('select.instructions'),
    }, signal, t)
    return { scope: { mode: 'instructions', text }, apply: parsed.apply }
  }

  const cwd = agent.session?.header?.cwd
  if (!cwd) throw new Error(t('error.noCwd'))

  if (choice === t('option.base')) {
    const branches = (await git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], signal))
      .split('\n')
      .filter(Boolean)
      .slice(0, 50)
    const ref = await ask(ctx, agent, {
      id: 'code-toolkit-base',
      question: t('select.base'),
      options: branches.map((label) => ({ label })),
    }, signal, t)
    return { scope: { mode: 'base', ref }, apply: parsed.apply }
  }

  const lines = (await git(cwd, ['log', '-n', '100', '--format=%H%x09%s'], signal)).split('\n').filter(Boolean)
  const options = lines.map((line) => {
    const [sha, ...subject] = line.split('\t')
    return { label: `${sha.slice(0, 10)} ${subject.join('\t')}`, sha }
  })
  const picked = await ask(ctx, agent, {
    id: 'code-toolkit-commit',
    question: t('select.commit'),
    options: options.map(({ label }) => ({ label })),
  }, signal, t)
  const found = options.find((item) => item.label === picked)
  return {
    scope: {
      mode: 'commit',
      ref: found?.sha ?? picked,
      ...(found ? { title: found.label.slice(11) } : {}),
    },
    apply: parsed.apply,
  }
}

/**
 * The concrete instruction handed to the subagent for a resolved scope.
 * The merge base is resolved here so the child does not have to guess which
 * diff a branch comparison means.
 */
export async function scopeInstruction(scope, { cwd, signal } = {}) {
  switch (scope.mode) {
    case 'worktree':
      return 'Scope: the uncommitted changes in this working directory (staged, unstaged, and untracked). Start with `git status --short` and `git diff HEAD`.'
    case 'base': {
      let base
      if (cwd) {
        try {
          base = await mergeBase(cwd, scope.ref, signal)
        } catch {
          base = undefined
        }
      }
      if (base) {
        return `Scope: everything this branch adds on top of \`${scope.ref}\`. The merge base is ${base}; start with \`git diff ${base}\` (and \`git log ${base}..HEAD\` for intent).`
      }
      return `Scope: everything this branch adds on top of \`${scope.ref}\`. Find the merge base first (\`git merge-base HEAD ${scope.ref}\`), then \`git diff <merge-base>\`.`
    }
    case 'commit':
      return `Scope: the single commit \`${scope.ref}\`${scope.title ? ` (${scope.title})` : ''}. Start with \`git show ${scope.ref}\`.`
    case 'files':
      return `Scope: only these paths — ${scope.paths.map((path) => `\`${path}\``).join(', ')}. Read them directly; do not widen the scope.`
    case 'instructions':
      return `Scope, as described by the user: ${scope.text}`
    default:
      return 'Scope: the uncommitted changes in this working directory.'
  }
}

/** Short human label for a scope, used in the report header. */
export function scopeLabel(scope) {
  switch (scope.mode) {
    case 'worktree':
      return 'working tree vs HEAD'
    case 'base':
      return `HEAD vs ${scope.ref}`
    case 'commit':
      return `commit ${scope.ref.slice(0, 10)}`
    case 'files':
      return scope.paths.join(', ')
    case 'instructions':
      return scope.text.length > 60 ? `${scope.text.slice(0, 60)}…` : scope.text
    default:
      return 'working tree'
  }
}
