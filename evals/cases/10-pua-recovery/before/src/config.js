// Read from the environment; the test runner loads .env.test, not .env.
export const config = {
  host: process.env.SERVICE_HOST ?? '127.0.0.1',
  port: Number(process.env.SERVICE_PORT ?? 5433),
}
