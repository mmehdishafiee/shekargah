// Emits dist/changelog.json from the local git history so the /changelog page
// can render every change with a Persian date. Falls back to an empty list when
// git is unavailable (for example in a tarball build).

import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function generateChangelog({ outDir }) {
  let commits = []
  try {
    const raw = execFileSync('git', ['log', '--pretty=format:%H%x1f%aI%x1f%s%x1e'], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    commits = raw
      .split('\x1e')
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [hash, date, subject] = record.split('\x1f')
        return { hash: (hash ?? '').slice(0, 7), date: date ?? '', subject: subject ?? '' }
      })
      .filter((commit) => commit.hash && commit.subject)
  } catch (error) {
    console.warn(`[changelog] git unavailable: ${error.message}`)
  }

  await writeFile(join(outDir, 'changelog.json'), `${JSON.stringify(commits, null, 1)}\n`, 'utf8')
  return { commits: commits.length }
}