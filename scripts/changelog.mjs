// Emits dist/changelog.json from the local git history so the /changelog page
// can render every change with a Persian date and a Persian title.
//
// Git subjects are written in English (the repo convention), so each commit
// hash is paired with a Persian title in `changelog-fa.json`. A commit without
// an entry still appears, with a neutral Persian label, and the build prints a
// warning so the map can be completed.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FALLBACK_TITLE = 'به‌روزرسانی شکارگاه'

function loadTitleMap() {
  try {
    return JSON.parse(readFileSync(new URL('./changelog-fa.json', import.meta.url), 'utf8'))
  } catch (error) {
    console.warn(`[changelog] Persian title map unavailable: ${error.message}`)
    return {}
  }
}

export async function generateChangelog({ outDir }) {
  const titles = loadTitleMap()
  let commits = []
  const unmapped = []

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
        const [fullHash, date, subject] = record.split('\x1f')
        const hash = (fullHash ?? '').slice(0, 7)
        if (hash && !titles[hash]) unmapped.push(hash)
        return { hash, date: date ?? '', title: titles[hash] ?? FALLBACK_TITLE, subject: subject ?? '' }
      })
      .filter((commit) => commit.hash && commit.subject)
  } catch (error) {
    console.warn(`[changelog] git unavailable: ${error.message}`)
  }

  if (unmapped.length > 0) {
    console.warn(`[changelog] no Persian title for: ${unmapped.join(', ')} — add them to scripts/changelog-fa.json`)
  }

  await writeFile(join(outDir, 'changelog.json'), `${JSON.stringify(commits, null, 1)}\n`, 'utf8')
  return { commits: commits.length }
}