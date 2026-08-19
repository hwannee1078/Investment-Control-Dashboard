export default function ExecutiveGuidePage() {
  return <main className="page-shell guide-page">
    <header className="page-heading"><div><p className="eyebrow">Executive Quick Guide</p><h1>대시보드 이용 안내</h1></div><p>처음 접속한 임원·직책자를 위한 조회 안내입니다.</p></header>
    <section className="guide-grid">
      <article className="dashboard-panel guide-card"><h2>1. 첫 화면에서 확인할 내용</h2><ul><li>소재별 사업현황: 양극재·음극재 사업 수와 사업 분포</li><li>사업별 투자비 현황: 승인투자비와 누적투자비 비교</li><li>사업목록: 사업 일정, 투자비 현황, 계획 대비 실적 사유</li></ul></article>
      <article className="dashboard-panel guide-card"><h2>2. 투자비 기준</h2><ul><li>승인투자비: 관리자가 등록한 사업 승인 예산</li><li>누적투자비: 월별 실적투자비를 누적한 금액</li><li>집행률: 누적투자비 ÷ 승인투자비 × 100</li><li>여러 투자오더는 사업에 매핑된 오더를 합산</li></ul></article>
      <article className="dashboard-panel guide-card"><h2>3. AI 챗봇 사용법</h2><ul><li>“포항 양극재 1단계 누적투자비는?”처럼 자연어로 질문</li><li>안전규정 질문은 승인된 공식 문서를 근거로 답변</li><li>투자비 질문은 대시보드 저장 데이터만 계산</li><li>근거가 없으면 추정하지 않고 “[NO_EVIDENCE]”로 안내</li></ul></article>
      <article className="dashboard-panel guide-card guide-warning"><h2>4. 답변을 그대로 믿어도 되나요?</h2><p>아니요. 모든 답변에는 데이터 또는 문서 근거가 필요합니다. “근거 없음”이 표시되면 사업명, 투자오더 매핑, Excel 업로드 상태를 확인한 뒤 담당자에게 문의하세요.</p></article>
    </section>
  </main>
}
