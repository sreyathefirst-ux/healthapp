'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { X, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface DetectedInfo {
  detected: boolean
  category?: string | null
  field?: string | null
  value?: string | null
  confirmationMessage?: string | null
}

const QUICK_REPLIES = [
  'How am I doing this week?',
  'Explain my health report',
  'I have a question about my plan',
]

const CHECKIN_STEPS = { morning: 6, night: 7 }

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10)
}

export function VitaChat() {
  // Panel
  const [isOpen, setIsOpen] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)

  // Messages
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Check-in state
  const [checkInMode, setCheckInMode] = useState<'morning' | 'night' | null>(null)
  const [checkInStep, setCheckInStep] = useState(0)

  // Health info detection
  const [pendingHealthInfo, setPendingHealthInfo] = useState<DetectedInfo | null>(null)

  // Badge + auth
  const [badge, setBadge] = useState<'morning' | 'night' | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initStartedRef = useRef(false)
  const checkInModeRef = useRef<'morning' | 'night' | null>(null)
  const checkInStepRef = useRef(0)

  // Keep refs in sync so async callbacks read current values
  useEffect(() => { checkInModeRef.current = checkInMode }, [checkInMode])
  useEffect(() => { checkInStepRef.current = checkInStep }, [checkInStep])

  // ── Auth + badge check on mount ─────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const [routineRes, logRes] = await Promise.all([
        supabase
          .from('routine_preferences')
          .select('wake_time, sleep_time')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('daily_logs')
          .select('morning_checkin_done, night_checkin_done')
          .eq('user_id', user.id)
          .eq('date', todayISO())
          .maybeSingle(),
      ])

      const wake = routineRes.data?.wake_time || '07:00'
      const sleep = routineRes.data?.sleep_time || '23:00'
      // Default to done=true if no log record (don't spam badge on first day)
      const morningDone = logRes.data?.morning_checkin_done ?? true
      const nightDone = logRes.data?.night_checkin_done ?? true

      const h = new Date().getHours()
      const wakeH = parseHour(wake)
      const sleepH = parseHour(sleep)

      if (!morningDone && h >= wakeH && h < wakeH + 3) setBadge('morning')
      else if (!nightDone && h >= Math.max(0, sleepH - 1) && h <= sleepH) setBadge('night')
    })
  }, [])

  // ── Panel scale animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setPanelVisible(true), 16)
    } else {
      setPanelVisible(false)
    }
  }, [isOpen])

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, isOpen])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const addMsg = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev: UIMessage[]) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content }])
  }, [])

  const callAPI = useCallback(async (
    message: string,
    ciType: string,
    ciStep: number
  ): Promise<{ content: string; detectedInfo: DetectedInfo } | null> => {
    try {
      const res = await fetch('/api/chat/vita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, checkInType: ciType, checkInStep: ciStep }),
      })
      const data = await res.json()
      return {
        content: data.content || "Sorry, I couldn't respond right now. Please try again.",
        detectedInfo: data.detectedInfo ?? { detected: false },
      }
    } catch {
      return null
    }
  }, [])

  const completeCheckIn = useCallback(async (mode: 'morning' | 'night') => {
    setCheckInMode(null)
    setCheckInStep(0)
    setBadge(null)
    if (!userId) return
    const supabase = createClient()
    const field = mode === 'morning' ? 'morning_checkin_done' : 'night_checkin_done'
    await supabase
      .from('daily_logs')
      .upsert({ user_id: userId, date: todayISO(), [field]: true }, { onConflict: 'user_id,date' })
  }, [userId])

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (override?: string) => {
    const text = (override ?? inputValue).trim()
    if (!text || isLoading) return

    setInputValue('')
    setPendingHealthInfo(null)

    // Don't add "Yes, save it" / "No thanks" as visible user bubbles from quick replies
    const isHealthReply = override === 'Yes, save it' || override === 'No thanks'
    if (!isHealthReply) addMsg('user', text)

    setIsLoading(true)

    const mode = checkInModeRef.current
    const step = checkInStepRef.current

    const result = await callAPI(text, mode ?? 'general', step)
    setIsLoading(false)

    if (!result) {
      addMsg('assistant', "Sorry, I had trouble connecting. Please try again.")
      return
    }

    addMsg('assistant', result.content)

    // Advance check-in step
    if (mode) {
      const newStep = step + 1
      setCheckInStep(newStep)
      if (newStep >= CHECKIN_STEPS[mode as 'morning' | 'night']) {
        completeCheckIn(mode)
      }
    }

    // Health info detection (general mode)
    if (!mode && result.detectedInfo?.detected && result.detectedInfo.confirmationMessage) {
      const info = result.detectedInfo
      setPendingHealthInfo(info)
      setTimeout(() => addMsg('assistant', info.confirmationMessage!), 400)
    }
  }, [inputValue, isLoading, addMsg, callAPI, completeCheckIn])

  // ── Save / dismiss health info ───────────────────────────────────────────────
  const handleSaveHealthInfo = useCallback(async () => {
    if (!pendingHealthInfo) return
    const info = pendingHealthInfo
    setPendingHealthInfo(null)
    addMsg('user', 'Yes, save it')
    setIsLoading(true)
    try {
      await fetch('/api/chat/vita', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: info.category, field: info.field, value: info.value }),
      })
      addMsg('assistant', "Done! I've added that to your profile. It will be reflected in your next weekly plan.")
    } catch {
      addMsg('assistant', "Sorry, I couldn't save that right now.")
    }
    setIsLoading(false)
  }, [pendingHealthInfo, addMsg])

  const handleDismissHealthInfo = useCallback(() => {
    setPendingHealthInfo(null)
    addMsg('user', 'No thanks')
    setTimeout(() => addMsg('assistant', "No problem! Just let me know if you change your mind."), 300)
  }, [addMsg])

  // ── Initialize chat on first open ────────────────────────────────────────────
  const initChat = useCallback(async (currentBadge: 'morning' | 'night' | null) => {
    if (!userId) return

    const supabase = createClient()
    const { data: history } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(50)

    // Load existing messages if any
    if (history && history.length > 0) {
      setMessages(history.map((m: { role: string; content: string }) => ({
        id: `db-${Math.random()}`,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })))
      // If badge is showing and check-in not done, start it even with history
      if (currentBadge) {
        setCheckInMode(currentBadge)
        setCheckInStep(0)
        setIsLoading(true)
        const trigger = currentBadge === 'morning' ? 'START_MORNING_CHECKIN' : 'START_NIGHT_CHECKIN'
        const result = await callAPI(trigger, currentBadge, 0)
        setIsLoading(false)
        if (result) addMsg('assistant', result.content)
      }
      return
    }

    // No history — fresh start
    if (currentBadge) {
      setCheckInMode(currentBadge)
      setCheckInStep(0)
      setIsLoading(true)
      const trigger = currentBadge === 'morning' ? 'START_MORNING_CHECKIN' : 'START_NIGHT_CHECKIN'
      const result = await callAPI(trigger, currentBadge, 0)
      setIsLoading(false)
      if (result) addMsg('assistant', result.content)
    } else {
      setIsLoading(true)
      const result = await callAPI('START_GENERAL_CHAT', 'general', 0)
      setIsLoading(false)
      if (result) addMsg('assistant', result.content)
    }
  }, [userId, callAPI, addMsg])

  // ── Open / close handlers ─────────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    if (isOpen) return
    const currentBadge = badge
    setBadge(null)
    setIsOpen(true)
    if (!initStartedRef.current) {
      initStartedRef.current = true
      initChat(currentBadge)
    }
    setTimeout(() => inputRef.current?.focus(), 420)
  }, [isOpen, badge, initChat])

  const handleClose = useCallback(() => {
    setPanelVisible(false)
    setTimeout(() => setIsOpen(false), 320)
  }, [])

  if (!userId) return null

  const showQuickReplies = messages.length <= 1 && !isLoading && !checkInMode && !pendingHealthInfo
  const showHealthButtons = !!pendingHealthInfo && !isLoading
  const canSend = inputValue.trim().length > 0 && !isLoading

  return (
    <>
      {/* ── Chat Panel ─────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed right-6 bottom-24 md:bottom-6"
          style={{
            width: 'min(375px, calc(100vw - 48px))',
            height: 'min(560px, calc(100vh - 120px))',
            borderRadius: 24,
            background: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transformOrigin: 'bottom right',
            transform: panelVisible ? 'scale(1)' : 'scale(0)',
            opacity: panelVisible ? 1 : 0,
            transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #6FD8A0 0%, #5DDAB8 50%, #B48FE8 100%)',
              height: 70,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              gap: 12,
              flexShrink: 0,
              borderRadius: '24px 24px 0 0',
            }}
          >
            <Image
              src="/leaf-logo.png"
              alt=""
              width={32}
              height={32}
              style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: 'white', margin: 0, lineHeight: 1.3 }}>
                Vita
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.3 }}>
                Your AI Health Assistant
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close Vita"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: 4, display: 'flex', borderRadius: 8, flexShrink: 0 }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              background: '#F8F9FA',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                {msg.role === 'assistant' && (
                  <Image
                    src="/leaf-logo.png"
                    alt=""
                    width={20}
                    height={20}
                    style={{ objectFit: 'contain', marginTop: 6, flexShrink: 0 }}
                  />
                )}
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '12px 14px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    ...(msg.role === 'assistant'
                      ? {
                          background: 'white',
                          border: '1px solid #EBEBF0',
                          borderRadius: '4px 16px 16px 16px',
                          color: '#1A1A2E',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        }
                      : {
                          background: 'linear-gradient(135deg, #8B7FD8, #B48FE8)',
                          borderRadius: '16px 4px 16px 16px',
                          color: 'white',
                        }),
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Image src="/leaf-logo.png" alt="" width={20} height={20} style={{ objectFit: 'contain', marginTop: 6, flexShrink: 0 }} />
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #EBEBF0',
                    borderRadius: '4px 16px 16px 16px',
                    padding: '14px 16px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="animate-bounce"
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#B48FE8',
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick replies — only on fresh general chat */}
            {showQuickReplies && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {QUICK_REPLIES.map(r => (
                  <button
                    key={r}
                    onClick={() => handleSend(r)}
                    style={{
                      background: 'white',
                      border: '1px solid #EBEBF0',
                      borderRadius: 999,
                      padding: '9px 16px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#1A1A2E',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Health info save / dismiss buttons */}
            {showHealthButtons && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={handleDismissHealthInfo}
                  style={{
                    background: 'white',
                    border: '1px solid #EBEBF0',
                    borderRadius: 999,
                    padding: '9px 16px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#6B6B8A',
                    cursor: 'pointer',
                  }}
                >
                  No thanks
                </button>
                <button
                  onClick={handleSaveHealthInfo}
                  style={{
                    background: 'linear-gradient(135deg, #6FD8A0, #5DDAB8)',
                    border: 'none',
                    borderRadius: 999,
                    padding: '9px 18px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Yes, save it
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              background: 'white',
              borderTop: '1px solid #EBEBF0',
              padding: '12px 16px',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexShrink: 0,
              borderRadius: '0 0 24px 24px',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask Vita anything..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: '#F8F9FA',
                border: '1px solid #EBEBF0',
                borderRadius: 999,
                padding: '10px 16px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: '#1A1A2E',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!canSend}
              aria-label="Send"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                cursor: canSend ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: canSend
                  ? 'linear-gradient(135deg, #6FD8A0 0%, #5DDAB8 50%, #B48FE8 100%)'
                  : '#EBEBF0',
                transition: 'background 0.2s',
              }}
            >
              <Send size={16} style={{ color: canSend ? 'white' : '#9B9BAA' }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Bubble ─────────────────────────────────────────────────────── */}
      <button
        onClick={handleOpen}
        aria-label="Chat with Vita"
        style={{
          position: 'fixed',
          bottom: 90,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6FD8A0 0%, #5DDAB8 50%, #B48FE8 100%)',
          boxShadow: '0 4px 20px rgba(93,218,184,0.4)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.05)')}
      >
        <Image
          src="/leaf-logo.png"
          alt="Vita"
          width={32}
          height={32}
          style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
        />
        {badge && (
          <span
            className="animate-pulse"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#E85D75',
              border: '2px solid white',
            }}
          />
        )}
      </button>
    </>
  )
}
