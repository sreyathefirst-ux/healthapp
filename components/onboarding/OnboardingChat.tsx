'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChatBubble } from '@/components/ui/ChatBubble'
import { Button } from '@/components/ui/Button'
import { Send, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STEP_LABELS = [
  'About You',
  'Bloodwork',
  'Health Goals',
  'Food Preferences',
  'Workout Preferences',
  'Daily Routine',
  'Meet Your Pet',
]

export function OnboardingChat() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Vitalia's AI health assistant. I'm going to help build your personalized health plan. Let's start with some basics — what's your name?",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    console.log('[OnboardingChat] sendMessage — step:', currentStep, '| messages being sent:', updatedMessages.length)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          step: currentStep,
          collectedData: {},
        }),
      })

      console.log('[OnboardingChat] /api/chat response status:', response.status, '| has body:', !!response.body)

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      let readCount = 0

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        readCount++
        if (done) {
          console.log('[OnboardingChat] stream done after', readCount, 'reads | final assistantText length:', assistantText.length)
          console.log('[OnboardingChat] final assistantText (first 200):', assistantText.slice(0, 200))
          break
        }
        const chunk = decoder.decode(value, { stream: true })
        if (readCount <= 3) console.log(`[OnboardingChat] read #${readCount} chunk:`, JSON.stringify(chunk.slice(0, 100)))
        assistantText += chunk

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }

      console.log('[OnboardingChat] messages state after stream:', messages.length + 2, 'total')

      const stepCompleteMatch = assistantText.match(/<step_complete>([\s\S]*?)<\/step_complete>/)
      if (stepCompleteMatch) {
        try {
          const stepData = JSON.parse(stepCompleteMatch[1])
          const nextStep = (stepData.step + 1) as OnboardingStep
          console.log('[OnboardingChat] step_complete detected — advancing to step', nextStep)

          const cleanText = assistantText.replace(/<step_complete>[\s\S]*?<\/step_complete>/g, '').trim()
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: cleanText || "Great! Let's move to the next step." }
            return updated
          })

          if (nextStep === 7) {
            setTimeout(() => router.push('/onboarding/pet'), 1500)
          } else if (nextStep <= 7) {
            setCurrentStep(nextStep)
          }
        } catch {}
      }
    } catch (error) {
      console.error('[OnboardingChat] fetch/stream error:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm sorry, something went wrong. Please try again." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploadingFile(true)
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `Uploading: ${file.name}` },
      { role: 'assistant', content: 'Processing your bloodwork PDF...' },
    ])

    console.log('[OnboardingChat] uploading file:', file.name, '| size:', file.size, '| type:', file.type)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/bloodwork/parse', { method: 'POST', body: formData })
      let data: { success?: boolean; biomarkers?: Array<{ biomarker_name: string; value: number; unit: string }>; error?: string }
      try {
        data = await res.json()
      } catch (jsonErr) {
        console.error('[OnboardingChat] failed to parse bloodwork response as JSON:', jsonErr, '| status:', res.status)
        throw new Error(`HTTP ${res.status}: response was not JSON`)
      }

      console.log('[OnboardingChat] bloodwork parse response — status:', res.status, '| success:', data.success, '| biomarkers:', data.biomarkers?.length ?? 0, '| error:', data.error)

      if (data.success && data.biomarkers && data.biomarkers.length > 0) {
        const shown = data.biomarkers.slice(0, 6)
        const markerList = shown
          .map((b) => `• ${b.biomarker_name}: ${b.value} ${b.unit}`)
          .join('\n')
        const extra = data.biomarkers.length > 6 ? `\n...and ${data.biomarkers.length - 6} more` : ''
        const msg = `Got it! I found these markers:\n${markerList}${extra}\n\nThis will help me tailor your plan perfectly. Let's move on!`
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: msg }
          return updated
        })
        setTimeout(() => setCurrentStep(3), 1500)
      } else {
        console.error('[OnboardingChat] bloodwork parse failed:', data.error || 'no biomarkers returned')
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: "I couldn't read that PDF. Can you try uploading again?",
          }
          return updated
        })
      }
    } catch (err) {
      console.error('[OnboardingChat] bloodwork upload error:', err)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: "I couldn't read that PDF. Can you try uploading again?",
        }
        return updated
      })
    } finally {
      setUploadingFile(false)
    }
  }

  function skipBloodwork() {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: "I'll skip bloodwork for now." },
      { role: 'assistant', content: "No problem! We can always add it later in Settings. Now let's talk about your health goals and concerns." },
    ])
    setTimeout(() => setCurrentStep(3), 1000)
  }

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* Progress header */}
      <div className="bg-white border-b border-vitalia-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/leaf-logo.png" alt="Vitalia" width={21} height={22} />
              <span className="font-black text-sm tracking-[2px] uppercase text-text-primary">VITALIA</span>
            </div>
            <span className="text-sm text-text-secondary">Step {currentStep} of 7</span>
          </div>
          <div className="flex gap-1">
            {STEP_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex-1 h-1.5 rounded-full transition-all"
                style={{ backgroundColor: i < currentStep ? '#10b981' : '#EBEBF0' }}
                title={label}
              />
            ))}
          </div>
          <p className="text-xs text-text-secondary mt-2">{STEP_LABELS[currentStep - 1]}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-2">
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role}>
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </ChatBubble>
          ))}
          {isLoading && (
            <ChatBubble role="assistant">
              <span className="flex gap-1">
                <span className="animate-bounce">•</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>•</span>
              </span>
            </ChatBubble>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bloodwork upload UI (step 2) */}
      {currentStep === 2 && (
        <div className="px-4 py-3 bg-accent-primary/10 border-t border-accent-primary/20">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              loading={uploadingFile}
            >
              <Upload size={16} />
              Upload PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={skipBloodwork}>
              Skip for now
            </Button>
            <span className="text-xs text-text-secondary">PDF blood test results only</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-vitalia-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type your message..."
            disabled={isLoading || currentStep === 2}
            className="flex-1 px-4 py-3 rounded-xl border-[1.5px] border-vitalia-border focus:outline-none focus:border-accent-primary text-sm disabled:opacity-50 bg-white transition-colors"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || currentStep === 2}
            loading={isLoading}
            size="md"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
