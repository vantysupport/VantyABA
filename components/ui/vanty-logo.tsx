import Image from 'next/image'

type VantyLogoProps = {
  size?: number
  withWordmark?: boolean
  /** 'app' = blue app icon for light surfaces; 'white' = bare white mark for brand-gradient surfaces. */
  variant?: 'app' | 'white'
  className?: string
}

const MARK_RATIO = 512 / 379

export function VantyLogo({ size = 32, withWordmark = true, variant = 'app', className = '' }: VantyLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {variant === 'white' ? (
        <Image
          src="/brand/vanty-mark-white.png"
          alt={withWordmark ? '' : 'Vanty ABA'}
          width={Math.round(size * MARK_RATIO)}
          height={size}
          priority
          className="drop-shadow-[0_4px_14px_rgba(0,40,120,0.35)]"
        />
      ) : (
        <Image
          src="/brand/vanty-logo-256.png"
          alt={withWordmark ? '' : 'Vanty ABA'}
          width={size}
          height={size}
          priority
          className="shadow-v-brand rounded-[23%]"
        />
      )}
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-tight">
          Vanty <span className="font-medium tracking-[0.08em] opacity-80">ABA</span>
        </span>
      )}
    </span>
  )
}
