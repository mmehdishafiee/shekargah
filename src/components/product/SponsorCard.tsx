import { ExternalLink, Handshake } from 'lucide-react'
import type { Sponsor } from '@/data/types'
import { hostnameOf } from '@/lib/text'
import { cardClass } from '@/components/ui/styles'

/**
 * Sponsor slot shown on the home page. Labelled so it is never mistaken for a product.
 *
 * `logoBg` / `logoFit` let a sponsor keep the background its mark was designed
 * for (e.g. a light-silver logo that only reads on a dark plate).
 */
export function SponsorCard({
  sponsor,
  logoBg = 'bg-sunken',
  logoFit = 'cover',
  logoBox = 'size-10',
}: {
  sponsor: Sponsor
  logoBg?: string
  logoFit?: 'cover' | 'contain'
  logoBox?: string
}) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className={`${cardClass} flex items-start gap-3 p-4 transition-colors hover:border-line-strong`}
    >
      <span className={`grid ${logoBox} shrink-0 place-items-center overflow-hidden rounded-lg text-ink-muted ${logoBg}`}>
        {sponsor.logoUrl ? (
          <img
            src={sponsor.logoUrl}
            alt=""
            className={`size-full ${logoFit === 'contain' ? 'object-contain' : 'object-cover'}`}
            loading="lazy"
          />
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