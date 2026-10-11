import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { createDefaultApi } from '@/data/api'
import { Providers } from './Providers'
import { routes } from './routes'
import './index.css'

const api = await createDefaultApi()
const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers api={api}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
