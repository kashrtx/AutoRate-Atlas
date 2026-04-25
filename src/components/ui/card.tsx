import type { PropsWithChildren } from 'react'
import { cn } from '../../lib/utils'

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn('glass rounded-2xl p-5', className)}>{children}</section>
}
