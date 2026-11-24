import fs from 'node:fs'

export async function loadConfig(path) {
  if (path) {
    if (fs.existsSync(path)) {
      const raw = fs.readFileSync(path, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed) {
        return parsed
      } else {
        return {}
      }
    } else {
      return {}
    }
  } else {
    return {}
  }
}

export function configPath(root) {
  return `${root}/config.json`
}
