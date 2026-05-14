'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES = [
  'How am I doing with my goals?',
  'What should I eat today?',
  'Give me a motivation boost',
]

function todayKey() {
  return `vita_checkin_${new Date().toDateString()}`
}

export function VitaChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasCheckInBadge, setHasCheckInBadge] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const greetingSentRef = useRef(false)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user)
    })
  }, [])

  // Badge: show during morning (6–10am) or evening (8pm–midnight) if not already dismissed today
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(todayKey())) return
    const h = new Date().getHours()
    if ((h >= 6 && h < 10) || h >= 20) {
      setHasCheckInBadge(true)
    }
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // On open: greet once, focus input, dismiss badge
  useEffect(() => {
    if (!isOpen) return

    if (hasCheckInBadge) {
      setHasCheckInBadge(false)
      localStorage.setItem(todayKey(), '1')
    }

    if (!greetingSentRef.current) {
      greetingSentRef.current = true
      const h = new Date().getHours()
      let content: string
      if (h >= 5 && h < 12) {
        content = "Good morning! How are you feeling today? I can help with your meal plan, workouts, or just check in on your progress."
      } else if (h >= 12 && h < 18) {
        content = "Good afternoon! How's your day going? I'm here to help with nutrition, workouts, or anything health-related."
      } else {
        content = "Good evening! How did your day go? I can help you wind down, review your progress, or plan for tomorrow."
      }
      setMessages([{ id: 'greeting', role: 'assistant', content }])
    }

    setTimeout(() => inputRef.current?.focus(), 200)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || isLoading) return

    const userMsg: Message = { id: String(Date.now()), role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInputValue('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/vita/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()) + '_ai',
          role: 'assistant',
          content: data.content || "Sorry, I couldn't get a response right now. Please try again.",
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()) + '_err',
          role: 'assistant',
          content: "Sorry, I had trouble connecting. Please check your connection and try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  if (!isAuthenticated) return null

  const showQuickReplies = messages.length === 1 && !isLoading
  const canSend = inputValue.trim().length > 0 && !isLoading

  return (
    <>
      {/* ── Chat Panel ── */}
      {isOpen && (
        <div
          className="fixed right-6 bottom-20 md:bottom-6 flex flex-col overflow-hidden shadow-2xl"
          style={{
            width: 'min(384px, calc(100vw - 48px))',
            height: 480,
            borderRadius: 24,
            background: 'white',
            border: '1px solid #e2e8f0',
            zIndex: 50,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #4ade80 0%, #2dd4bf 50%, #9333ea 100%)',
              borderRadius: '24px 24px 0 0',
            }}
          >
            <Image
              src="/leaf-logo.png"
              alt=""
              width={24}
              height={24}
              style={{ filter: 'brightness(0) invert(1)', flexShrink: 0 }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-none mb-0.5">Vita</p>
              <p className="text-white text-xs leading-none" style={{ opacity: 0.9 }}>
                Your AI Health Assistant
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-white hover:bg-white/20 transition-colors flex-shrink-0"
              aria-label="Close Vita chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-2xl rounded-br-sm'
                      : 'text-slate-900 bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm'
                  }`}
                  style={
                    msg.role === 'user'
                      ? { background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }
                      : undefined
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Quick replies — shown after greeting only */}
            {showQuickReplies && (
              <div className="flex flex-col gap-2 pt-1">
                {QUICK_REPLIES.map(reply => (
                  <button
                    key={reply}
                    onClick={() => sendMessage(reply)}
                    className="text-left px-4 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 bg-white flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Vita..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            />
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={!canSend}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${
                canSend ? 'hover:scale-105' : 'cursor-not-allowed'
              }`}
              style={
                canSend
                  ? { background: 'linear-gradient(135deg, #4ade80, #a855f7)' }
                  : { background: '#e2e8f0' }
              }
              aria-label="Send message"
            >
              <Send size={18} style={{ color: canSend ? 'white' : '#94a3b8' }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Bubble ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed right-6 bottom-24 flex items-center justify-center shadow-2xl transition-transform duration-200 hover:scale-110 active:scale-95"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #4ade80 0%, #2dd4bf 50%, #9333ea 100%)',
          zIndex: 40,
        }}
        aria-label={isOpen ? 'Close Vita' : 'Chat with Vita'}
      >
        <Image
          src="/leaf-logo.png"
          alt="Vita"
          width={32}
          height={32}
          style={{ filter: 'brightness(0) invert(1)' }}
        />
        {hasCheckInBadge && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>
    </>
  )
}
