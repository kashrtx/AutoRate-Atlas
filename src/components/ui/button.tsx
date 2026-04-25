import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
        'bg-primary/90 text-slate-950 hover:bg-primary',
        className,
      )}
      {...props}
    />
  )
}
