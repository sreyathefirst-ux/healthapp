import { ReactNode } from 'react'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  children: ReactNode
}

export function ChatBubble({ role, children }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1">
          ✨
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-accent-primary text-text-primary rounded-br-sm'
            : 'bg-white text-text-primary shadow-card rounded-bl-sm'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
