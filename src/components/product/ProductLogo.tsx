import type { CSSProperties } from 'react'
import { hueFor, initial } from '@/lib/text'

interface ProductLogoProps {
  name: string
  seed: string
  url: string | null
  size?: number
}

export function ProductLogo({ name, seed, url, size = 56 }: ProductLogoProps) {
  const radius = Math.round(size * 0.22)
  if (url) {
    return (
      <img
        src={url}
        alt={`لوگوی ${name}`}
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 border border-line bg-surface object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    )
  }
  const hue = hueFor(seed)
  return (
    <span
      role="img"
      aria-label={`لوگوی ${name}`}
      className="pastel-fallback grid shrink-0 place-items-center font-extrabold"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.round(size * 0.44),
        '--h': hue,
      } as CSSProperties}
    >
      {initial(name)}
    </span>
  )
}
