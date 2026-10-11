import { useEffect } from 'react'

const SITE = 'شکارگاه'
const DEFAULT_DESCRIPTION =
  'شکارگاه جایی برای کشف استارتاپ‌ها، اپلیکیشن‌ها، پروژه‌های متن‌باز و ابزارهای تازه‌ی ایرانی است.'

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

/** Updates the document title and description for the current route. */
export function useDocumentMeta(title?: string, description?: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} | کشف محصولات تازه‌ی ایرانی`
    const desc = description ?? DEFAULT_DESCRIPTION
    document.title = fullTitle
    setMeta('name', 'description', desc)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', desc)
  }, [title, description])
}
