'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { motion, type HTMLMotionProps, type Transition } from 'motion/react'

type FlipDirection = 'top' | 'right' | 'bottom' | 'left'

const SPRING: Transition = { type: 'spring', stiffness: 280, damping: 20 }
const FlipContext = createContext<FlipDirection>('top')

const AXIS: Record<FlipDirection, { rotate: 'rotateX' | 'rotateY'; sign: 1 | -1 }> = {
  top: { rotate: 'rotateX', sign: 1 },
  bottom: { rotate: 'rotateX', sign: -1 },
  left: { rotate: 'rotateY', sign: -1 },
  right: { rotate: 'rotateY', sign: 1 },
}

type FlipButtonProps = HTMLMotionProps<'button'> & { from?: FlipDirection; tapScale?: number; children: ReactNode }

export function FlipButton({ from = 'top', tapScale = 0.95, className = '', children, ...props }: FlipButtonProps) {
  return (
    <FlipContext.Provider value={from}>
      <motion.button
        initial="initial"
        whileHover="hover"
        whileTap={{ scale: tapScale }}
        className={`relative inline-grid h-11 place-items-center v-brand rounded-full px-6 text-[15px] font-semibold [perspective:900px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v-accent disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    </FlipContext.Provider>
  )
}

type FaceProps = HTMLMotionProps<'span'> & { transition?: Transition; children: ReactNode }

export function FlipButtonFront({ transition = SPRING, className = '', children, ...props }: FaceProps) {
  const { rotate, sign } = AXIS[useContext(FlipContext)]
  return (
    <motion.span
      variants={{ initial: { [rotate]: 0, opacity: 1 }, hover: { [rotate]: 90 * sign, opacity: 0 } }}
      transition={transition}
      className={`col-start-1 row-start-1 [backface-visibility:hidden] ${className}`}
      {...props}
    >
      {children}
    </motion.span>
  )
}

export function FlipButtonBack({ transition = SPRING, className = '', children, ...props }: FaceProps) {
  const { rotate, sign } = AXIS[useContext(FlipContext)]
  return (
    <motion.span
      variants={{ initial: { [rotate]: -90 * sign, opacity: 0 }, hover: { [rotate]: 0, opacity: 1 } }}
      transition={transition}
      className={`col-start-1 row-start-1 [backface-visibility:hidden] ${className}`}
      {...props}
    >
      {children}
    </motion.span>
  )
}
