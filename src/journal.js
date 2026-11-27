import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * One durable record per session: what ran, when, and the rendered result.
 *
 * The session log is the source of truth for conversation; this is the
 * plugin's own note, so `/code-status` still works after a restart and a run
 * that died mid-flight is distinguishable from one that never started.
 */
export class Journal {
  constructor(directory) {
    this.directory = directory
  }

  static defaultDirectory() {
    const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    return join(home, 'code-toolkit')
  }

  /**
   * The file one session's record lives in, named after a hash of its id.
   *
   * A missing or non-string id throws rather than being coerced: `createHash`
   * rejects a non-string argument, and silently hashing `undefined` would put
   * every unidentified session into one shared file.
   */
  path(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new Error('Journal.path needs a session id')
    }
    return join(this.directory, `${createHash('sha256').update(sessionId).digest('hex')}.json`)
  }

  async read(sessionId) {
    let raw
    try {
      raw = await readFile(this.path(sessionId), 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined
      throw error
    }
    const record = JSON.parse(raw)
    if (!record || record.version !== 1) return undefined
    return record
  }

  async write(sessionId, record) {
    await mkdir(this.directory, { recursive: true })
    const destination = this.path(sessionId)
    const temp = `${destination}.${randomUUID()}.tmp`
    try {
      await writeFile(temp, `${JSON.stringify({ version: 1, ...record })}\n`, { encoding: 'utf8', flag: 'wx' })
      await rename(temp, destination)
    } catch (error) {
      try {
        await unlink(temp)
      } catch {
        /* temp file never existed or is already gone */
      }
      throw error
    }
  }
}
