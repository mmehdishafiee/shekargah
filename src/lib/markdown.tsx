import { Fragment, type ReactNode } from 'react'

/**
 * Minimal, safe Markdown renderer for blog posts.
 *
 * It builds React elements instead of HTML strings, so untrusted post content
 * can never inject a script or attribute. Supported: headings, bold, italic,
 * inline code, links, ordered/unordered lists, blockquotes, horizontal rules
 * and paragraphs.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    const key = `${keyPrefix}-i${index++}`

    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]" dir="ltr">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-bold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={key}>{token.slice(1, -1)}</em>,
      )
    } else {
      const label = token.slice(1, token.indexOf(']'))
      const href = match[4] ?? '#'
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-700 hover:underline">
          {label}
        </a>,
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function renderMarkdown(source: string): ReactNode {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0
  let key = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (!line.trim()) {
      index += 1
      continue
    }

    if (/^\s*---+\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${key++}`} className="my-6 border-line" />)
      index += 1
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]!.length
      const text = heading[2] ?? ''
      const className =
        level === 1 ? 'mt-8 text-2xl font-extrabold' : level === 2 ? 'mt-8 text-xl font-extrabold' : 'mt-6 text-lg font-bold'
      const Tag = (`h${Math.min(level + 1, 6)}`) as 'h2'
      blocks.push(
        <Tag key={`h-${key++}`} className={className} dir="auto">
          {renderInline(text, `h-${key}`)}
        </Tag>,
      )
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quoted.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push(
        <blockquote key={`q-${key++}`} dir="auto" className="my-5 border-s-4 border-brand-200 bg-sunken/60 px-4 py-3 text-[15px] leading-8 text-ink-muted">
          {renderInline(quoted.join(' '), `q-${key}`)}
        </blockquote>,
      )
      continue
    }

    const bullet = /^\s*[-*]\s+/
    const numbered = /^\s*\d+\.\s+/
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line)
      const items: string[] = []
      const matcher = ordered ? numbered : bullet
      while (index < lines.length && matcher.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(matcher, ''))
        index += 1
      }
      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag
          key={`l-${key++}`}
          className={`my-4 space-y-2 ps-6 text-[15px] leading-8 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-brand-600`}
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex} dir="auto">
              {renderInline(item, `li-${key}-${itemIndex}`)}
            </li>
          ))}
        </ListTag>,
      )
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^(#{1,4})\s/.test(lines[index] ?? '') &&
      !/^>\s?/.test(lines[index] ?? '') &&
      !/^\s*[-*]\s+/.test(lines[index] ?? '') &&
      !/^\s*\d+\.\s+/.test(lines[index] ?? '') &&
      !/^\s*---+\s*$/.test(lines[index] ?? '')
    ) {
      paragraph.push(lines[index] ?? '')
      index += 1
    }
    blocks.push(
      <p key={`p-${key++}`} dir="auto" className="my-4 text-[15px] leading-8">
        {renderInline(paragraph.join(' '), `p-${key}`)}
      </p>,
    )
  }

  return <Fragment>{blocks}</Fragment>
}

/** Plain-text preview used for cards and meta descriptions. */
export function markdownToPlain(source: string, limit = 200): string {
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text
}