/**
 * Client-side image normalisation.
 *
 * Every upload is converted to WebP before it leaves the browser so storage
 * never accumulates PNG/JPEG files. Sources that already are WebP are left
 * untouched (no needless re-encode). Very large screenshots are capped in
 * pixels, which keeps files small without a visible quality change.
 */

const MAX_DIMENSION = 2400

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_decode_failed'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/webp', quality))
}

/**
 * Returns a WebP version of `file`, or the original file when the browser
 * cannot encode WebP or the source already is WebP.
 *
 * PNG sources (logos, UI screenshots) are encoded at the highest quality so
 * text and edges stay crisp; photographic JPEGs use 92 which is visually
 * indistinguishable at these sizes.
 */
export async function toWebpFile(file: File): Promise<File> {
  if (file.type === 'image/webp') return file
  if (!/^image\/(png|jpeg|jpg)$/.test(file.type)) return file

  try {
    const image = await loadImage(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)

    const quality = file.type === 'image/png' ? 1 : 0.92
    const blob = await canvasToBlob(canvas, quality)
    if (!blob || blob.type !== 'image/webp') return file

    const name = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    // Any decode/encode failure falls back to the original upload so the user
    // is never blocked from submitting.
    return file
  }
}
