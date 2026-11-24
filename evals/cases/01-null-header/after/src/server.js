export function startSession(store, header) {
  const id = store.nextId()
  const cwd = header.cwd
  store.save({ id, header, cwd, startedAt: Date.now() })
  return id
}

export function endSession(store, id) {
  store.save({ id, endedAt: Date.now() })
  return id
}
