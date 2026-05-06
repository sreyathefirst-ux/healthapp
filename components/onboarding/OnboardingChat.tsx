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

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }

      // Check for step complete marker
      const stepCompleteMatch = assistantText.match(/<step_complete>([\s\S]*?)<\/step_complete>/)
      if (stepCompleteMatch) {
        try {
          const stepData = JSON.parse(stepCompleteMatch[1])
          const nextStep = (stepData.step + 1) as OnboardingStep

          // Clean the assistant message (remove the step_complete block)
          const cleanText = assistantText.replace(/<step_complete>[\s\S]*?<\/step_complete>/g, '').trim()
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: cleanText || "Great! Let's move to the next step." }
            return updated
          })

          if (nextStep === 7) {
            // Redirect to pet selection
            setTimeout(() => router.push('/onboarding/pet'), 1500)
          } else if (nextStep <= 7) {
            setCurrentStep(nextStep)
          }
        } catch {}
      }
    } catch (error) {
      console.error('Chat error:', error)
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

    setUploadingFile(true)
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `Uploading: ${file.name}` },
    ])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/bloodwork/parse', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.biomarkers && data.biomarkers.length > 0) {
        const markerList = data.biomarkers.slice(0, 5).map((b: { biomarker_name: string; value: number; unit: string }) => `• ${b.biomarker_name}: ${b.value} ${b.unit}`).join('\n')
        const msg = `Got it! I found the following markers in your bloodwork:\n${markerList}${data.biomarkers.length > 5 ? `\n...and ${data.biomarkers.length - 5} more` : ''}\n\nThis will help me tailor your plan. Let's move on!`
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
        setTimeout(() => setCurrentStep(3), 1500)
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: "I had trouble reading that file. No worries — let's move on without it!" }])
        setTimeout(() => setCurrentStep(3), 1500)
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Upload failed. Let's skip for now and move on!" }])
      setTimeout(() => setCurrentStep(3), 1500)
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
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌿</span>
              <span className="font-semibold text-text-primary">Vitalia</span>
            </div>
            <span className="text-sm text-text-secondary">Step {currentStep} of 7</span>
          </div>
          <div className="flex gap-1">
            {STEP_LABELS.map((label, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-all ${i < currentStep ? 'bg-accent-primary' : 'bg-gray-200'}`}
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
      <div className="bg-white border-t border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type your message..."
            disabled={isLoading || currentStep === 2}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-accent-primary text-sm disabled:opacity-50"
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
