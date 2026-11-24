import { formatDuration } from './format.js'

export const elapsed = (start) => formatDuration(Date.now() - start)
