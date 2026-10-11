import { describe, expect, it } from 'vitest'
import { formatNumber, formatRelative } from './format'
import { hostnameOf, normalizeFa, slugify } from './text'
import indexHtml from '../../index.html?raw'
import { isHttpUrl, validateComment, validateImage, validateProduct, validateUsername } from './validation'

describe('text helpers', () => {
  it('normalises Arabic yeh and kaf to Persian', () => {
    expect(normalizeFa('كتاب علي')).toBe('کتاب علی')
  })

  it('builds the same Persian-friendly slugs as the database', () => {
    expect(slugify('دفترچه ابری')).toBe('دفترچه-ابری')
    expect(slugify('  Shekargah  API!! ')).toBe('shekargah-api')
    expect(slugify('نقشه‌راه')).toBe('نقشه-راه')
    expect(slugify('!!!')).toBe('')
  })

  it('extracts readable hostnames', () => {
    expect(hostnameOf('https://www.example.com/path?q=1')).toBe('example.com')
  })
})

describe('formatting', () => {
  it('uses Persian digits', () => {
    expect(formatNumber(1234)).toBe('۱٬۲۳۴')
  })

  it('formats relative times in Persian', () => {
    const now = new Date('2026-01-10T12:00:00Z')
    expect(formatRelative('2026-01-10T11:59:50Z', now)).toBe('همین حالا')
    expect(formatRelative('2026-01-08T12:00:00Z', now)).toBe('پریروز')
  })
})

describe('validation', () => {
  const valid = {
    name: 'دفترچه',
    tagline: 'یادداشت‌برداری آفلاین و ساده',
    description: 'یک برنامه‌ی یادداشت که بدون اینترنت هم کار می‌کند و همگام می‌شود.',
    websiteUrl: 'https://example.com',
    categoryId: 'c-01',
    logo: null,
  }

  it('accepts a complete product', () => {
    expect(validateProduct(valid)).toEqual({})
  })

  it('reports every invalid field in Persian', () => {
    const errors = validateProduct({ ...valid, name: '', tagline: 'کوتاه', websiteUrl: 'javascript:alert(1)', categoryId: '' })
    expect(errors).toEqual({
      name: 'نام محصول را وارد کنید.',
      tagline: 'معرفی کوتاه باید دست‌کم ۱۰ نویسه باشد.',
      websiteUrl: 'نشانی باید کامل و با https:// یا http:// شروع شود.',
      categoryId: 'یک دسته‌بندی انتخاب کنید.',
    })
  })

  it('only accepts http(s) URLs with a real host', () => {
    expect(isHttpUrl('https://example.ir/app')).toBe(true)
    expect(isHttpUrl('ftp://example.ir')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('https://localhost')).toBe(false)
  })

  it('restricts image types and sizes', () => {
    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'logo.png', { type: 'image/png' })
    const ok = new File([new Uint8Array(10)], 'logo.webp', { type: 'image/webp' })
    expect(validateImage(svg, 1024 * 1024)).toMatch(/PNG/)
    expect(validateImage(big, 1024 * 1024)).toMatch(/حجم/)
    expect(validateImage(ok, 1024 * 1024)).toBeUndefined()
  })

  it('validates usernames and comments', () => {
    expect(validateUsername('Sara')).toBeDefined()
    expect(validateUsername('sara_99')).toBeUndefined()
    expect(validateComment('   ')).toBe('متن نظر را بنویسید.')
    expect(validateComment('x'.repeat(1001))).toMatch(/بیشتر/)
  })
})

describe('index.html', () => {
  it('declares Persian language and right-to-left direction', () => {
    expect(indexHtml).toMatch(/<html lang="fa" dir="rtl">/)
  })
})
