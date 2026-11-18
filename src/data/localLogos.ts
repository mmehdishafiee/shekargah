// Product icons harvested from each product's own website, for products that
// were published without an uploaded logo. Files live in src/assets/logos and
// are keyed by product id, so they follow the product row, not its slug.
const files = import.meta.glob('../assets/logos/*.{webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const byProductId: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, ''),
    url,
  ]),
)

/** Local fallback icon for a product that has no stored logo, if one exists. */
export const localLogo = (productId: string): string | null => byProductId[productId] ?? null