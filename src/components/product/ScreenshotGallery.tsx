import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export interface GalleryShot {
  url: string
  alt: string | null
}

/**
 * Clickable screenshot gallery with a full-size lightbox.
 * Arrow keys, Escape and clicking the backdrop all work.
 */
export function ScreenshotGallery({ shots, productName }: { shots: GalleryShot[]; productName: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const open = openIndex !== null

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null)
      if (event.key === 'ArrowRight') setOpenIndex((current) => (current === null ? current : (current + 1) % shots.length))
      if (event.key === 'ArrowLeft') setOpenIndex((current) => (current === null ? current : (current - 1 + shots.length) % shots.length))
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, shots.length])

  if (shots.length === 0) return null

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {shots.map((shot, index) => (
          <button
            key={`${shot.url}-${index}`}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={`بزرگ‌کردن اسکرین‌شات ${index + 1} از ${shots.length}`}
            className="group relative overflow-hidden rounded-lg border border-line bg-sunken focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <img
              src={shot.url}
              alt={shot.alt ?? `اسکرین‌شات ${productName}`}
              loading="lazy"
              className="aspect-video w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 text-xs font-semibold text-white opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
              برای دیدن اندازه‌ی کامل کلیک کن
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`اسکرین‌شات‌های ${productName}`}
          className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
          onClick={() => setOpenIndex(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="text-sm font-medium">
              اسکرین‌شات {openIndex! + 1} از {shots.length}
            </p>
            <button
              type="button"
              aria-label="بستن"
              onClick={() => setOpenIndex(null)}
              className="grid size-9 place-items-center rounded-full hover:bg-white/15"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-4 sm:px-6">
            {shots.length > 1 && (
              <button
                type="button"
                aria-label="قبلی"
                onClick={(event) => {
                  event.stopPropagation()
                  setOpenIndex((current) => (current === null ? current : (current - 1 + shots.length) % shots.length))
                }}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight size={22} strokeWidth={2} aria-hidden />
              </button>
            )}

            <img
              src={shots[openIndex!]!.url}
              alt={shots[openIndex!]!.alt ?? `اسکرین‌شات ${productName}`}
              onClick={(event) => event.stopPropagation()}
              className="mx-auto max-h-full max-w-full rounded-lg object-contain shadow-pop"
            />

            {shots.length > 1 && (
              <button
                type="button"
                aria-label="بعدی"
                onClick={(event) => {
                  event.stopPropagation()
                  setOpenIndex((current) => (current === null ? current : (current + 1) % shots.length))
                }}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft size={22} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
