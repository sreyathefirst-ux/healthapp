import { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  children: ReactNode
}

export function ChatBubble({ role, children }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1 text-white"
          style={{ background: 'linear-gradient(135deg, #0FCB8C 0%, #2BAEE6 50%, #9B53E6 100%)' }}
        >
          <Sparkles size={15} />
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'text-white'
            : 'bg-white text-text-primary shadow-card border border-vitalia-border'
        }`}
        style={isUser
          ? {
              background: 'linear-gradient(135deg, #2BAEE6 0%, #9B53E6 100%)',
              borderRadius: '20px 4px 20px 20px',
            }
          : { borderRadius: '4px 20px 20px 20px' }
        }
      >
        {children}
      </div>
    </div>
  )
}
