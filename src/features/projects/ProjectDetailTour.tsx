import { useEffect, useState } from 'react'

const SEEN_KEY = 'investment-dashboard.project-detail-tour-seen.v1'
const STEPS = [
  { selector: '[data-detail-tour="basic"]', title: '사업 기본정보', body: '소재, 지역, 현재 단계와 승인투자비를 확인합니다. 승인투자비 아래에는 누적투자비와 집행률이 함께 표시됩니다.' },
  { selector: '[data-detail-tour="schedule"]', title: '주요 일정', body: '사업승인·토건착공·기전착공·준공·SOP의 계획과 실적 날짜를 비교합니다.' },
  { selector: '[data-detail-tour="rolling"]', title: '분기별 Rolling Plan 비교', body: '분기별 계획과 실적 투자비를 비교합니다. 분기 막대를 클릭하면 해당 분기의 월별 그래프가 펼쳐집니다.' },
  { selector: '[data-detail-tour="rolling-quarter"]', title: '월별 실적과 차이 사유', body: '분기 그래프를 클릭한 뒤 월별 막대를 클릭하면 계획·실적 금액과 입력된 차이 사유를 확인할 수 있습니다.' },
]

export default function ProjectDetailTour({ enabled, onClosed }: { enabled: boolean; onClosed?: () => void }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const current = STEPS[step]
  useEffect(() => { if (enabled && localStorage.getItem(SEEN_KEY) !== 'true') setOpen(true) }, [enabled])
  useEffect(() => {
    if (!open || !current) return
    const element = document.querySelector(current.selector)
    const update = () => setRect(element?.getBoundingClientRect() ?? null)
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, current])
  if (!enabled || !open || !current) return null
  const close = () => { localStorage.setItem(SEEN_KEY, 'true'); setOpen(false); onClosed?.() }
  const style = rect ? { top: Math.min(window.innerHeight - 220, Math.max(18, rect.bottom + 16)), left: Math.min(window.innerWidth - 370, Math.max(18, rect.left)) } : { top: '50%', left: '50%' }
  return <div className="executive-tour project-detail-tour" role="dialog" aria-modal="true" aria-labelledby="project-tour-title">
    {rect ? <div className="executive-tour__spotlight" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} /> : null}
    <div className="executive-tour__card" style={style}><p className="eyebrow">Project Guide · {step + 1}/{STEPS.length}</p><h2 id="project-tour-title">{current.title}</h2><p>{current.body}</p><div className="executive-tour__actions"><button type="button" className="text-button" onClick={close}>다시 보지 않기</button><button type="button" className="primary-button" onClick={() => step === STEPS.length - 1 ? close() : setStep((value) => value + 1)}>{step === STEPS.length - 1 ? '완료' : '다음'}</button></div></div>
  </div>
}

export function ProjectDetailTourRestart({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  if (!enabled) return null
  return <><button type="button" className="dashboard-guide-button" onClick={() => setOpen(true)}>도움말 다시 보기</button>{open ? <ProjectDetailTour key="restart" enabled onClosed={() => setOpen(false)} /> : null}</>
}
