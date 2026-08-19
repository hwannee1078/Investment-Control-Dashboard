import { useEffect, useMemo, useState } from 'react'

const TOUR_SEEN_KEY = 'investment-dashboard.executive-tour-seen.v1'

type TourStep = { selector: string; title: string; body: string }

const STEPS: TourStep[] = [
  { selector: '[data-tour-target="materials"]', title: '소재별 사업현황', body: '양극재와 음극재 사업 수를 확인할 수 있습니다. 도넛 영역에 마우스를 올리면 소재별 사업 목록이 표시됩니다.' },
  { selector: '[data-tour-target="investment"]', title: '사업별 투자비 현황', body: '승인투자비를 100% 기준으로 누적투자비를 비교합니다. 바를 통해 집행 규모와 누적률을 확인할 수 있습니다.' },
  { selector: '[data-tour-target="business-list"]', title: '사업목록', body: '사업별 계획·실적 일정과 투자비 현황을 한 화면에서 확인합니다.' },
  { selector: '[data-tour-target="project-link"]', title: '사업 상세 화면', body: '사업명을 클릭하면 해당 사업의 기본정보, 일정, Rolling Plan 상세 화면으로 이동합니다.' },
  { selector: '[data-tour-target="schedule-reason"]', title: '일정 실적 사유', body: '밑줄과 굵게 표시된 실적 날짜에 마우스를 올리면 계획 대비 단축·지연 사유를 확인할 수 있습니다.' },
]

export default function ExecutiveTour({ enabled, initialOpen = false, onClosed }: { enabled: boolean; initialOpen?: boolean; onClosed?: () => void }) {
  const [open, setOpen] = useState(initialOpen)
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const target = useMemo(() => current ? document.querySelector(current.selector) : null, [current, open])
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (localStorage.getItem(TOUR_SEEN_KEY) !== 'true') setOpen(true)
  }, [enabled])

  useEffect(() => {
    if (!open || !target) return
    const update = () => setRect(target.getBoundingClientRect())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, target])

  if (!enabled || !open || !current) return null
  const close = () => { localStorage.setItem(TOUR_SEEN_KEY, 'true'); setOpen(false); onClosed?.() }
  const next = () => step === STEPS.length - 1 ? close() : setStep((value) => value + 1)
  const style = rect ? { top: Math.min(window.innerHeight - 220, Math.max(18, rect.bottom + 16)), left: Math.min(window.innerWidth - 370, Math.max(18, rect.left)) } : { top: '50%', left: '50%' }

  return <div className="executive-tour" role="dialog" aria-modal="true" aria-labelledby="executive-tour-title">
    {rect ? <div className="executive-tour__spotlight" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} /> : null}
    <div className="executive-tour__card" style={style}>
      <p className="eyebrow">Dashboard Guide · {step + 1}/{STEPS.length}</p>
      <h2 id="executive-tour-title">{current.title}</h2>
      <p>{current.body}</p>
      <div className="executive-tour__actions"><button type="button" className="text-button" onClick={close}>다시 보지 않기</button><button type="button" className="primary-button" onClick={next}>{step === STEPS.length - 1 ? '완료' : '다음'}</button></div>
    </div>
  </div>
}

export function ExecutiveTourRestart({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  if (!enabled) return null
  return <><button type="button" className="dashboard-guide-button" onClick={() => setOpen(true)}>도움말 다시 보기</button>{open ? <ExecutiveTour key="restart" enabled initialOpen onClosed={() => setOpen(false)} /> : null}</>
}
