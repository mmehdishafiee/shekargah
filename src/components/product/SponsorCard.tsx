import { ExternalLink, Handshake } from 'lucide-react'
import type { Sponsor } from '@/data/types'
import { hostnameOf } from '@/lib/text'
import { cardClass } from '@/components/ui/styles'

/** Sponsor slot shown on the home page. Labelled so it is never mistaken for a product. */
export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className={`${cardClass} flex items-start gap-3 p-4 transition-colors hover:border-line-strong`}
    >
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-sunken text-ink-muted">
        {sponsor.logoUrl ? (
          <img src={sponsor.logoUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <Handshake size={18} strokeWidth={1.75} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-bold">{sponsor.name}</span>
          <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-muted">حامی</span>
        </span>
        {sponsor.tagline && <span className="mt-0.5 block line-clamp-2 text-[13px] leading-6 text-ink-muted">{sponsor.tagline}</span>}
        <span className="ltr mt-1 flex items-center gap-1 text-[12px] text-ink-faint">
          {hostnameOf(sponsor.url)}
          <ExternalLink size={11} strokeWidth={1.75} aria-hidden />
        </span>
      </span>
    </a>
  )
}