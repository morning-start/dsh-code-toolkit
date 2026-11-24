import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'

// The runner loads .env.test, as the real project's setup does.
for (const line of readFileSync(new URL('../.env.test', import.meta.url), 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line)
  if (match) process.env[match[1]] = match[2]
}

test('connects to the service', async () => {
  const { connect } = await import('../src/connect.js')
  const server = createServer((socket) => socket.end())
  await new Promise((resolve) => server.listen(5433, '127.0.0.1', resolve))
  try {
    assert.equal(await connect(), true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
