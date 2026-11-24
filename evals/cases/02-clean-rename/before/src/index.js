import { fmtDuration } from './format.js'

export const elapsed = (start) => fmtDuration(Date.now() - start)
