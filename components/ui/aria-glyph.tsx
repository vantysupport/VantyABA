// ARIA's mascot (origami figure on brand blue). Fills its round container.
export function AriaGlyph({ className = '' }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/aria-avatar.webp" alt="" aria-hidden draggable={false} className={`absolute inset-0 size-full rounded-full object-cover ${className}`} />
  )
}
