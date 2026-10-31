import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { createDefaultApi } from '@/data/api'
import { Providers } from './Providers'
import { routes } from './routes'
import { ConfigErrorScreen } from '@/components/ConfigErrorScreen'
import './index.css'

const router = createBrowserRouter(routes)

const root = createRoot(document.getElementById('root')!)
try {
  const api = await createDefaultApi()
  root.render(
    <StrictMode>
      <Providers api={api}>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  )
} catch (error) {
  root.render(<ConfigErrorScreen error={error} />)
}
