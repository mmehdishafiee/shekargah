/**
 * Renders mixed Persian/Latin text without letting one Latin word flip the
 * direction of a whole paragraph.
 *
 * Each line is rendered on its own with `unicode-bidi: plaintext`, so its
 * direction is decided by that line's first strong character. Latin tokens
 * inside a line stay isolated, and long unbroken strings cannot overflow.
 */
export function BidiText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  return (
    <span className={`bidi block ${className}`}>
      {lines.map((line, index) => (
        <span key={index} className="bidi block">
          {line.trim() ? line : '\u00A0'}
        </span>
      ))}
    </span>
  )
}
