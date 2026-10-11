import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { createDemoApi } from '@/data/demoApi'
import { DEMO_ADMIN_EMAIL, DEMO_USER_EMAIL, createDemoState } from '@/data/demoSeed'
import { renderApp } from '@/test/render'

async function signedInApi(email: string) {
  const api = createDemoApi({ storage: null, state: createDemoState() })
  await api.signIn({ email, password: 'secret-password' })
  return api
}

describe('home feed', () => {
  it('shows published products ranked by votes, in Persian', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'کشف محصولات تازه' })).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'فهرست محصولات' })
    const items = within(list).getAllByRole('article')
    expect(items[0]).toHaveTextContent('جلالی‌کیت')
    expect(items[0]).toHaveTextContent('۱.')
    expect(screen.queryByText('کارنما')).not.toBeInTheDocument()
  })

  it('filters by category and searches', async () => {
    const { user } = renderApp('/')
    await screen.findByText('جلالی‌کیت')
    await user.click(screen.getByRole('button', { name: 'آموزش' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'آموزش' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('جلالی‌کیت')).not.toBeInTheDocument())
    expect(screen.getByText('زبانچه')).toBeInTheDocument()

    const [search] = screen.getAllByRole('searchbox', { name: 'جست‌وجوی محصولات' })
    await user.type(search!, 'رصد{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'نتیجه‌های «رصد»' })).toBeInTheDocument()
  })

  it('shows a helpful empty state when nothing matches', async () => {
    renderApp('/?q=چیزی-که-نیست')
    expect(await screen.findByText('محصولی پیدا نشد')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'برداشتن فیلترها' })).toBeInTheDocument()
  })
})

describe('voting', () => {
  it('sends anonymous voters to the login page', async () => {
    const { user, router } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'رأی به جلالی‌کیت' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('toggles a vote for signed-in users', async () => {
    const { user } = renderApp('/', await signedInApi(DEMO_USER_EMAIL))
    const button = await screen.findByRole('button', { name: 'رأی به جلالی‌کیت' })
    expect(button).toHaveTextContent('۲۱۴')
    await user.click(button)
    const voted = await screen.findByRole('button', { name: 'پس گرفتن رأی از جلالی‌کیت' })
    expect(voted).toHaveAttribute('aria-pressed', 'true')
    expect(voted).toHaveTextContent('۲۱۵')
    await user.click(voted)
    expect(await screen.findByRole('button', { name: 'رأی به جلالی‌کیت' })).toHaveTextContent('۲۱۴')
  })
})

describe('product page', () => {
  it('renders a product from a direct nested URL, with maker and comments', async () => {
    renderApp(`/products/${encodeURIComponent('جلالی‌کیت')}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'جلالی‌کیت' })).toBeInTheDocument()
    expect(screen.getByText('امیر کاظمی')).toBeInTheDocument()
    expect(await screen.findByText(/کتابخانه‌ی شمسی/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'وارد حسابت شو' })).toBeInTheDocument()
    expect(document.title).toBe('جلالی‌کیت | شکارگاه')
  })

  it('renders comment text literally instead of as HTML', async () => {
    const api = await signedInApi(DEMO_USER_EMAIL)
    const { user } = renderApp(`/products/${encodeURIComponent('رصدگر')}`, api)
    const box = await screen.findByRole('textbox', { name: /نظرت را بنویس/ })
    await user.type(box, '<img src=x onerror=alert(1)> عالی')
    await user.click(screen.getByRole('button', { name: 'ارسال نظر' }))
    expect(await screen.findByText('<img src=x onerror=alert(1)> عالی')).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('shows not-found for unknown products', async () => {
    renderApp('/products/not-a-product')
    expect(await screen.findByText('این محصول پیدا نشد')).toBeInTheDocument()
  })
})

describe('submissions', () => {
  it('requires sign-in', async () => {
    const { router } = renderApp('/submit')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('validates in Persian and confirms that moderation is required', async () => {
    const { user } = renderApp('/submit', await signedInApi(DEMO_USER_EMAIL))
    await user.click(await screen.findByRole('button', { name: 'ثبت برای بررسی' }))
    expect(await screen.findByText('نام محصول را وارد کنید.')).toBeInTheDocument()
    expect(screen.getByText('یک دسته‌بندی انتخاب کنید.')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'نام محصول' }), 'نوت‌بوک تیمی')
    await user.type(screen.getByRole('textbox', { name: 'معرفی کوتاه' }), 'یادداشت مشترک برای تیم‌های کوچک')
    await user.type(
      screen.getByRole('textbox', { name: 'توضیحات' }),
      'نوت‌بوک تیمی به اعضای تیم کمک می‌کند یادداشت‌های جلسه را با هم بنویسند.',
    )
    await user.type(screen.getByRole('textbox', { name: 'نشانی وب‌سایت' }), 'https://example.com/team')
    await user.selectOptions(screen.getByRole('combobox', { name: 'دسته‌بندی' }), 'بهره‌وری')
    await user.click(screen.getByRole('button', { name: 'ثبت برای بررسی' }))

    expect(await screen.findByRole('heading', { name: '«نوت‌بوک تیمی» ثبت شد' })).toBeInTheDocument()
    expect(screen.getByText(/در صف بررسی است/)).toBeInTheDocument()
  })
})

describe('admin', () => {
  it('blocks regular users', async () => {
    renderApp('/admin', await signedInApi(DEMO_USER_EMAIL))
    expect(await screen.findByText('دسترسی به این بخش نداری')).toBeInTheDocument()
  })

  it('lets admins approve pending products, which then appear in the feed', async () => {
    const api = await signedInApi(DEMO_ADMIN_EMAIL)
    const { user } = renderApp('/admin', api)
    expect(await screen.findByRole('heading', { level: 1, name: 'پنل مدیریت' })).toBeInTheDocument()
    const card = (await screen.findByRole('link', { name: 'کارنما' })).closest('li')!
    await user.click(within(card).getByRole('button', { name: 'تأیید و انتشار' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'انتشار محصول' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'کارنما' })).not.toBeInTheDocument())

    const feed = await api.listProducts({ sort: 'newest', page: 0 })
    expect(feed.items.some((p) => p.name === 'کارنما')).toBe(true)
  })

  it('requires a reason to reject', async () => {
    const { user } = renderApp('/admin', await signedInApi(DEMO_ADMIN_EMAIL))
    const card = (await screen.findByRole('link', { name: 'شمارشگر' })).closest('li')!
    await user.click(within(card).getByRole('button', { name: 'رد' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'رد محصول' }))
    expect(await within(dialog).findByText('این فیلد را پر کنید.')).toBeInTheDocument()
  })
})

describe('auth', () => {
  it('signs up and lands signed in (demo mode)', async () => {
    const { user, router } = renderApp('/signup')
    await user.type(await screen.findByRole('textbox', { name: 'نام نمایشی' }), 'کاربر تازه')
    await user.type(screen.getByRole('textbox', { name: 'ایمیل' }), 'new@example.com')
    await user.type(screen.getByLabelText('رمز عبور'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'ساخت حساب' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await screen.findByRole('button', { name: 'منوی حساب کاربری' })).toBeInTheDocument()
  })

  it('shows Persian errors for bad credentials', async () => {
    const { user } = renderApp('/login')
    await user.type(await screen.findByRole('textbox', { name: 'ایمیل' }), 'nobody@example.com')
    await user.type(screen.getByLabelText('رمز عبور'), 'whatever-password')
    await user.click(screen.getByRole('button', { name: 'ورود' }))
    expect(await screen.findByText('ایمیل یا رمز عبور درست نیست.')).toBeInTheDocument()
  })
})
