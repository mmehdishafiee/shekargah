import { Link } from 'react-router'
import type { TagRef } from '@/data/types'

interface TagChipsProps {
  tags: TagRef[]
  activeSlug?: string | null
}

export function TagChips({ tags, activeSlug = null }: TagChipsProps) {
  if (tags.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Link
          key={tag.slug}
          to={`/?tag=${tag.slug}`}
          className={`relative z-10 rounded-md border px-2 py-0.5 text-[12px] font-medium transition-colors hover:border-line-strong hover:text-ink ${
            activeSlug === tag.slug ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-muted'
          }`}
        >
          #{tag.name}
        </Link>
      ))}
    </span>
  )
}
