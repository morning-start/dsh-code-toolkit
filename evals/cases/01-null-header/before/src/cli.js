import { startSession } from './server.js'

const store = {
  rows: [],
  nextId() {
    return this.rows.length + 1
  },
  save(row) {
    this.rows.push(row)
  },
}

export function openDefaultSession() {
  return startSession(store)
}
