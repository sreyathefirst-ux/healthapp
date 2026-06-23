'use client'

import { ReactNode } from 'react'

// Circular progress ring with optional brand gradient stroke.
export function Ring({
  size = 132,
  stroke = 13,
  value = 0,
  max = 100,
  grad = false,
  color = '#07C281',
  track = '#ECEEE8',
  children,
}: {
  size?: number
  stroke?: number
  value?: number
  max?: number
  grad?: boolean
  color?: string
  track?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(value / max, 1))
  const dash = c * pct
  const id = `ring-grad-${size}-${stroke}`

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0FCB8C" />
            <stop offset="0.52" stopColor="#2BAEE6" />
            <stop offset="1" stopColor="#9B53E6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={grad ? `url(#${id})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray .8s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}
