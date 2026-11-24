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

/**
 * Split the modifier tokens off the command line.
 *
 * `sub` routes the task to an isolated agent; `report` asks for a plan instead of
 * an edit. Both are optional and positional, so `sub report --base main` works.
 */
export function splitFlags(rawInput) {
  const tokens = String(rawInput ?? '').trim().split(/\s+/).filter(Boolean)
  const flags = { sub: false, report: false }
  const rest = []
  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === 'sub') { flags.sub = true; continue }
    if (lower === 'report') { flags.report = true; continue }
    rest.push(token)
  }
  return { ...flags, rest: rest.join(' ') }
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

/** The repository's default branch, ignoring a ref that already equals HEAD. */
async function defaultBase(cwd, signal) {
  const head = await resolveRef(cwd, 'HEAD', signal)
  for (const ref of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
    const resolved = await resolveRef(cwd, ref, signal)
    if (resolved && resolved !== head) return ref
  }
  return undefined
}

/**
 * Turn a symbolic scope into a concrete one.
 *
 * "Current branch" only means something when the branch has a base to compare
 * with; on a repository where the work happens on main, the merge base is HEAD
 * and the diff is empty. Falling back to the recent commits keeps the default
 * useful instead of producing a review of nothing.
 */
export async function resolveScope(scope, { cwd, signal } = {}) {
  if (scope.mode !== 'branch' || !cwd) return scope
  try {
    const ref = await defaultBase(cwd, signal)
    const base = ref ? await mergeBase(cwd, ref, signal) : undefined
    if (base) return { mode: 'base', ref }
  } catch {
    /* not a repository, or no base to find */
  }
  return { mode: 'recent', count: 5 }
}

/** Whether this scope has anything to look at; a clean tree is a real answer. */
export async function scopeHasChanges(scope, { cwd, signal } = {}) {
  if (!cwd) return true
  const changed = async (args) => (await git(cwd, args, signal)).trim().length > 0
  try {
    switch (scope.mode) {
      case 'worktree':
        return await changed(['status', '--porcelain'])
      case 'base': {
        const base = await mergeBase(cwd, scope.ref, signal)
        if (!base) return true
        return (await changed(['diff', '--name-only', base])) || (await changed(['ls-files', '--others', '--exclude-standard']))
      }
      case 'commit':
        return true
      case 'recent':
        return true
      default:
        return true
    }
  } catch {
    return true
  }
}

/**
 * Resolve the scope. An explicit line wins; otherwise the command's own default
 * applies — no question, because a command with no arguments must do something
 * sensible on its own.
 */
export async function selectScope(ctx, agent, rawInput, signal, t, fallback = 'project') {
  const parsed = parseArgs(rawInput)
  if (parsed.scope) return parsed
  return { scope: { mode: fallback }, apply: parsed.apply }
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
    case 'project':
      return 'Scope: the whole project on the current branch — every source file under the repository root, not only the diff. Start by listing the tree and reading the files you will touch; do not limit yourself to recent changes.'
    case 'branch': {
      let ref
      let base
      if (cwd) {
        try {
          ref = await defaultBase(cwd, signal)
          if (ref) base = await mergeBase(cwd, ref, signal)
        } catch {
          base = undefined
        }
      }
      if (base) {
        return `Scope: everything this branch adds on top of \`${ref}\`. The merge base is ${base}; start with \`git diff ${base}\` (and \`git log ${base}..HEAD\` for intent).`
      }
      return 'Scope: the changes on the current branch. Find the base first (`git merge-base HEAD origin/main`), then diff against it; when the repository has no base branch, fall back to `git diff HEAD`.'
    }
    case 'recent':
      return `Scope: the last ${scope.count} commits on the current branch (the branch has no base to compare with). Start with \`git log -${scope.count} --oneline\` and \`git diff HEAD~${scope.count}..HEAD\`; if the history is shorter, diff against the root commit.`
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
    case 'project':
      return 'whole project'
    case 'branch':
      return 'current branch'
    case 'recent':
      return `last ${scope.count} commits`
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
