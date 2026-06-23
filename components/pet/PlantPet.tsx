'use client'

// PlantPet — "Shauna" the flower companion, ported from the Vitalia design.
//   · Health score (0–100) → 5 health states that scale the bloom, grow the
//     smile and add sparkles as it climbs.
//   · Condition (carried from yesterday) overlays Sad / Sick / Recovering on top.
// Built from hand-drawn PNG layers in a 400×400 design space, scaled to `size`.

import { useEffect, useRef, useState, CSSProperties } from 'react'

export type PetCondition = 'sad' | 'sick' | 'recovering' | null

// ── score (0-100) → health-state key ──
export function moodOf(score: number) {
  if (score >= 81) return 'thriving'
  if (score >= 61) return 'blooming'
  if (score >= 41) return 'growing'
  if (score >= 21) return 'happy'
  return 'neutral'
}

export function moodMeta(score: number) {
  const m = moodOf(score)
  const map = {
    neutral: { key: m, label: 'Neutral', tone: 'neutral', line: 'is having a calm, fresh start today.' },
    happy: { key: m, label: 'Happy', tone: 'green', line: 'is happy — a lovely start to the day.' },
    growing: { key: m, label: 'Growing', tone: 'green', line: 'is growing as your day builds.' },
    blooming: { key: m, label: 'Blooming', tone: 'green', line: 'is blooming beautifully today.' },
    thriving: { key: m, label: 'Thriving', tone: 'green', line: 'is positively thriving. Keep it going.' },
  } as const
  return map[m]
}

export function conditionMeta(cond: PetCondition) {
  if (!cond) return null
  const map = {
    sad: { key: 'sad', label: 'Sad', tone: 'amber', msg: 'I missed some of our goals yesterday. Complete any task today and I’ll feel better.' },
    sick: { key: 'sick', label: 'Sick', tone: 'rose', msg: 'Yesterday was tough. Help me reach 40 points today so I can recover.' },
    recovering: { key: 'recovering', label: 'Recovering', tone: 'green', msg: 'I’m feeling better already. Let’s keep going.' },
  } as const
  return map[cond]
}

interface Visual {
  mood: string
  bloom: number
  mouth: 'smile' | 'open' | 'sad' | 'sick'
  mouthScale: number
  eye: number
  sat: number
  spark: number
  tilt: number
  leaf: number | null
  leafDroop: number
  bright: number
}

function petVisual(score: number, condition: PetCondition): Visual {
  const mood = moodOf(score)
  const bases: Record<string, Omit<Visual, 'mood' | 'tilt' | 'leaf' | 'leafDroop' | 'bright'>> = {
    neutral: { bloom: 0.86, mouth: 'smile', mouthScale: 0.9, eye: 0.86, sat: 0.94, spark: 0 },
    happy: { bloom: 0.94, mouth: 'smile', mouthScale: 1.05, eye: 0.97, sat: 1.0, spark: 0 },
    growing: { bloom: 1.0, mouth: 'smile', mouthScale: 1.28, eye: 1.0, sat: 1.0, spark: 0 },
    blooming: { bloom: 1.08, mouth: 'open', mouthScale: 1.0, eye: 1.0, sat: 1.03, spark: 3 },
    thriving: { bloom: 1.15, mouth: 'open', mouthScale: 1.22, eye: 1.0, sat: 1.06, spark: 6 },
  }
  const v: Visual = { mood, ...bases[mood], tilt: 0, leaf: null, leafDroop: 0, bright: 1 }
  if (condition === 'sad') {
    v.mouth = 'sad'; v.eye = Math.min(v.eye, 0.62); v.tilt = 6; v.leaf = 0.9; v.leafDroop = 15; v.sat *= 0.88; v.spark = 0
  } else if (condition === 'sick') {
    v.mouth = 'sick'; v.eye = 0.42; v.tilt = 11; v.leaf = 0.74; v.leafDroop = 26; v.sat = 0.5; v.bright = 0.97; v.spark = 0
  } else if (condition === 'recovering') {
    v.tilt = 2; v.spark = Math.max(v.spark, 4)
  }
  return v
}

const ppSrc = (name: string) => `/pet/${name}.png`

function PPLayer({
  name, x, y, w, h, className, style,
}: { name: string; x: number; y: number; w: number; h: number; className?: string; style?: CSSProperties }) {
  return (
    <img
      src={ppSrc(name)}
      alt=""
      draggable={false}
      className={className}
      style={{ position: 'absolute', left: x, top: y, width: w, height: h, display: 'block', ...style }}
    />
  )
}

function PetMouth({ kind, scale = 1 }: { kind: Visual['mouth']; scale?: number }) {
  if (kind === 'open') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <img
          src={ppSrc('mouth')}
          alt=""
          draggable={false}
          style={{ width: 36.72, height: 22.08, transform: `scale(${scale})`, transformOrigin: '50% 0%', display: 'block', transition: 'transform .4s ease' }}
        />
      </div>
    )
  }
  const BR = '#5C3A2E'
  let d: string, sw = 2.8, grow = false
  if (kind === 'smile') { d = 'M11 11 Q20 18 29 11'; sw = 2.8; grow = true }
  else if (kind === 'sad') { d = 'M11 15 Q20 10 29 15'; sw = 2.6 }
  else { d = 'M11 16 Q20 8 29 16'; sw = 2.6 }
  return (
    <svg
      width="100%" height="100%" viewBox="0 0 40 24"
      style={{ display: 'block', overflow: 'visible', transform: grow ? `scale(${scale})` : 'none', transformOrigin: '50% 20%', transition: 'transform .4s ease' }}
    >
      <path d={d} fill="none" stroke={BR} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface Spark { id: string; tx: number; ty: number; ts: number; kind: 'spark' | 'heart'; dur: number }

export function PlantPet({
  size = 168,
  score = 57,
  condition = null,
  celebrateSignal = 0,
  interactive = true,
  onPet,
}: {
  size?: number
  score?: number
  condition?: PetCondition
  celebrateSignal?: number
  interactive?: boolean
  onPet?: () => void
}) {
  const v = petVisual(score, condition)
  const ref = useRef<HTMLDivElement>(null)
  const [eye, setEye] = useState({ x: 0, y: 0 })
  const [celebrating, setCelebrating] = useState(false)
  const [petting, setPetting] = useState(false)
  const [sparks, setSparks] = useState<Spark[]>([])
  const k = size / 400
  const leafScale = v.leaf != null ? v.leaf : Math.min(1, 0.76 + v.bloom * 0.22)
  const droopy = v.tilt >= 6
  const swayAnim = droopy ? 'pp-swayLow 5.4s ease-in-out infinite' : 'pp-sway 4.6s ease-in-out infinite'

  useEffect(() => {
    if (!interactive) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = ref.current; if (!el) return
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.26
        const dx = e.clientX - cx, dy = e.clientY - cy
        const d = Math.hypot(dx, dy) || 1
        const max = 3.4
        setEye({ x: (dx / d) * max, y: Math.max(-max, Math.min(max, (dy / d) * max)) })
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => { window.removeEventListener('mousemove', onMove); if (raf) cancelAnimationFrame(raf) }
  }, [interactive])

  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    burst(14)
    setCelebrating(true)
    const t = setTimeout(() => setCelebrating(false), 950)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateSignal])

  function burst(n: number) {
    const id = Date.now()
    const arr: Spark[] = Array.from({ length: n }, (_, i) => {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5
      const dist = size * (0.34 + Math.random() * 0.3)
      return {
        id: id + '-' + i,
        tx: Math.cos(a) * dist,
        ty: Math.sin(a) * dist - size * 0.16,
        ts: 0.7 + Math.random() * 0.9,
        kind: Math.random() > 0.45 ? 'spark' : 'heart',
        dur: 0.9 + Math.random() * 0.5,
      }
    })
    setSparks(arr)
    setTimeout(() => setSparks([]), 1500)
  }

  function pet() {
    if (!interactive) return
    setPetting(true)
    burst(6)
    setTimeout(() => setPetting(false), 520)
    onPet?.()
  }

  return (
    <div
      ref={ref}
      onClick={pet}
      title={interactive ? 'Pet me' : undefined}
      style={{ position: 'relative', width: size, height: size, cursor: interactive ? 'pointer' : 'default' }}
    >
      {/* celebration particles */}
      {sparks.map((s) => (
        <span
          key={s.id}
          className="vt-anim"
          style={{
            position: 'absolute', top: '26%', left: '50%', width: size * 0.1, height: size * 0.1,
            marginLeft: -size * 0.05, marginTop: -size * 0.05,
            ['--tx' as string]: s.tx + 'px', ['--ty' as string]: s.ty + 'px', ['--ts' as string]: s.ts,
            animation: `vt-spark ${s.dur}s ease-out forwards`, pointerEvents: 'none',
            color: s.kind === 'heart' ? '#E07C97' : '#F5C85A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          } as CSSProperties}
        >
          {s.kind === 'heart' ? (
            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12 21s-7-4.6-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.4 12 21 12 21Z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /></svg>
          )}
        </span>
      ))}

      {/* ambient twinkles */}
      {v.spark > 0 && Array.from({ length: v.spark }).map((_, i) => {
        const a = (Math.PI * 2 * i) / v.spark + 0.5, R = size * (0.3 + (i % 2) * 0.07)
        return (
          <span
            key={i}
            className="vt-anim"
            style={{
              position: 'absolute', left: `calc(50% + ${Math.cos(a) * R}px)`, top: `calc(26% + ${Math.sin(a) * R}px)`,
              width: size * 0.07, height: size * 0.07, color: '#F5C85A',
              animation: `vt-twinkle ${2.2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`, pointerEvents: 'none',
            }}
          >
            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /></svg>
          </span>
        )
      })}

      {/* 400×400 design stage, scaled */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 400, height: 400, transform: `scale(${k})`, transformOrigin: 'top left' }}>
        {/* ground shadow */}
        <div style={{ position: 'absolute', left: 200, top: 388, width: 150, height: 22, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(70,54,40,.16), transparent 70%)', pointerEvents: 'none' }} />

        {/* pot */}
        <PPLayer name="pot" x={129.5} y={272} w={141} h={118.2} />

        {/* sway group */}
        <div
          className={'vt-anim ' + (celebrating ? 'vt-celebrate ' : '') + (petting ? 'vt-petting' : '')}
          style={{ position: 'absolute', inset: 0, transformOrigin: '200px 282px', animation: celebrating || petting ? undefined : swayAnim }}
        >
          <div style={{ position: 'absolute', inset: 0, transformOrigin: '200px 282px', transform: `rotate(${v.tilt}deg)`, filter: `saturate(${v.sat}) brightness(${v.bright})`, transition: 'all .5s ease' }}>
            {/* leaves */}
            <div style={{ position: 'absolute', inset: 0, transformOrigin: '201px 232px', transform: `scale(${leafScale}) rotate(${-v.leafDroop}deg)`, transition: 'transform .5s ease' }}>
              <PPLayer name="leaf-left" x={114.9} y={188.5} w={88.4} h={59.3} className="vt-anim" style={{ transformOrigin: '100% 80%', animation: 'pp-leafL 3.6s ease-in-out infinite' }} />
            </div>
            <div style={{ position: 'absolute', inset: 0, transformOrigin: '199px 232px', transform: `scale(${leafScale}) rotate(${v.leafDroop}deg)`, transition: 'transform .5s ease' }}>
              <PPLayer name="leaf-right" x={196.7} y={188.5} w={87.1} h={59.8} className="vt-anim" style={{ transformOrigin: '0% 80%', animation: 'pp-leafR 3.9s ease-in-out -0.6s infinite' }} />
            </div>

            <PPLayer name="stem" x={188.6} y={165} w={22.8} h={127} />

            {/* bloom group */}
            <div style={{ position: 'absolute', inset: 0, transformOrigin: '200px 180px', transform: `scale(${v.bloom})`, transition: 'transform .5s ease' }}>
              <PPLayer name="petals" x={110.65} y={10} w={178} h={185.1} />
              <PPLayer name="face" x={148.16} y={55.03} w={104.24} h={100.67} />

              {/* eyes */}
              <div style={{ position: 'absolute', left: 162.4, top: 83.6, width: 75.8, height: 24.7, transformOrigin: '50% 50%', transform: `scaleY(${v.eye})`, transition: 'transform .3s ease' }}>
                <div className="vt-anim" style={{ width: '100%', height: '100%', transformOrigin: '50% 50%', animation: 'vt-blink 4.6s ease-in-out infinite' }}>
                  <div style={{ width: '100%', height: '100%', transform: `translate(${eye.x}px,${eye.y}px)`, transition: 'transform .1s linear' }}>
                    <img src={ppSrc('eyes')} alt="" draggable={false} style={{ width: '100%', height: '100%', display: 'block' }} />
                  </div>
                </div>
              </div>

              {/* mouth */}
              <div style={{ position: 'absolute', left: 181.91, top: 116.73, width: 36.72, height: 22.08 }}>
                <PetMouth kind={v.mouth} scale={v.mouthScale || 1} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// compact circular avatar
export function PlantPetMini({ size = 52, score = 57, condition = null }: { size?: number; score?: number; condition?: PetCondition }) {
  const B = size * 2.4
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#EDE7FE,#E2FBF0)', display: 'inline-flex', flex: '0 0 auto', overflow: 'hidden', position: 'relative' }}>
      <span style={{ position: 'absolute', left: -0.7 * size, top: -0.124 * size, width: B, height: B }}>
        <PlantPet size={B} score={score} condition={condition} interactive={false} />
      </span>
    </span>
  )
}
