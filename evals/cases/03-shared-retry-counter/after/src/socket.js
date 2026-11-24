let attempt = 0

export async function connectWithRetry(connect, url, maxRetries = 3) {
  for (; attempt < maxRetries; attempt++) {
    try {
      await connect(url)
      return true
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
    }
  }
  return false
}
