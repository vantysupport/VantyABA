'use client'

import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

type SheetProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description?: string
  children: ReactNode
}

export function Sheet({ open, onOpenChange, trigger, title, description, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-[#081426]/40 backdrop-blur-[2px]" />
        <Drawer.Content className="v-scope fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg outline-none">
          <Drawer.Handle className="mt-3 !w-10 !bg-[var(--v-border-strong)]" />
          <div className="px-6 pt-4 pb-2">
            <Drawer.Title className="text-xl font-semibold tracking-tight">{title}</Drawer.Title>
            {description && <Drawer.Description className="mt-1 text-sm text-v-muted">{description}</Drawer.Description>}
          </div>
          <div className="overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
