import { connect as netConnect } from 'node:net'

import { config } from './config.js'

/** Resolve once the service accepts the connection, reject on the socket error. */
export function connect() {
  return new Promise((resolve, reject) => {
    const socket = netConnect({ host: config.host, port: config.port })
    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })
    socket.once('error', reject)
  })
}
