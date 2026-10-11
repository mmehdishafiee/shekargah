export const productPath = (slug: string) => `/products/${encodeURIComponent(slug)}`
export const profilePath = (username: string) => `/u/${encodeURIComponent(username)}`
