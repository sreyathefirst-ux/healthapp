'use client'

import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ToastProvider } from '@/components/ui/Toast'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-green-50">
        <Sidebar />
        <main className="md:ml-60 pb-20 md:pb-0 min-h-screen">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </ToastProvider>
  )
}
