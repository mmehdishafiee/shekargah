import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createDemoApi } from '@/data/demoApi'
import { createDemoState } from '@/data/demoSeed'
import type { ShekargahApi } from '@/data/types'
import { Providers } from '@/Providers'
import { routes } from '@/routes'

/** Render the whole app at `path` on top of a fresh, in-memory demo backend. */
export function renderApp(path = '/', api: ShekargahApi = createDemoApi({ storage: null, state: createDemoState() })) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const utils = render(
    <Providers api={api} queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { ...utils, api, router, user }
}
