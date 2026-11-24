export function startSession(store, header = {}) {
  const id = store.nextId()
  store.save({ id, header, startedAt: Date.now() })
  return id
}

export function endSession(store, id) {
  store.save({ id, endedAt: Date.now() })
  return id
}
