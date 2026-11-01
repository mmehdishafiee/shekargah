import type { CSSProperties } from 'react'
import { hueFor, initial } from '@/lib/text'

interface AvatarProps {
  name: string
  seed: string
  url: string | null
  size?: number
}

export function Avatar({ name, seed, url, size = 32 }: AvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-full bg-sunken object-cover ring-1 ring-line"
        style={{ width: size, height: size }}
      />
    )
  }
  const hue = hueFor(seed)
  return (
    <span
      aria-hidden
      className="pastel-fallback grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        '--h': hue,
      } as CSSProperties}
    >
      {initial(name)}
    </span>
  )
}
