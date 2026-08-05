import type { ImportResult } from '../../services/investmentImport'

type ImportPreviewProps = {
  result: ImportResult
  onConfirm: () => void
  onCancel: () => void
}

const amountFormatter = new Intl.NumberFormat('ko-KR')

export default function ImportPreview({
  result,
  onConfirm,
  onCancel,
}: ImportPreviewProps) {
  const sourceIds = [...new Set([
    ...result.rows.map(({ sourceId }) => sourceId),
    ...result.errors.map(({ sourceId }) => sourceId),
  ])].filter((sourceId) => sourceId !== '')

  return (
    <section className="import-preview" aria-labelledby="import-preview-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Validation Preview</p>
          <h2 id="import-preview-title">가져오기 미리보기</h2>
        </div>
        <p>{sourceIds.join(', ')}</p>
      </div>

      <section className="preview-section" aria-label="유효 행">
        <h3>유효 행 ({result.rows.length})</h3>
        {result.rows.length === 0 ? (
          <p className="empty-state">가져올 수 있는 행이 없습니다.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">파일</th>
                  <th scope="col">오더번호</th>
                  <th scope="col">기준월</th>
                  <th scope="col">투자금액</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={`${row.sourceId}-${row.rowId}`}>
                    <td>{row.sourceId}</td>
                    <th scope="row">{row.orderId}</th>
                    <td>{row.month}</td>
                    <td>{amountFormatter.format(row.amount)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="preview-message-grid">
        <section className="preview-section" aria-label="검증 오류">
          <h3>검증 오류 ({result.errors.length})</h3>
          {result.errors.length === 0 ? (
            <p className="empty-state">검증 오류가 없습니다.</p>
          ) : (
            <ul className="message-list error-list">
              {result.errors.map((error, index) => (
                <li key={`${error.sourceId}-${error.rowId ?? 'file'}-${error.code}-${index}`}>
                  <strong>{error.rowId ?? error.sourceId}</strong>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="preview-section" aria-label="중복 행">
          <h3>중복 행 ({result.duplicates.length})</h3>
          {result.duplicates.length === 0 ? (
            <p className="empty-state">중복 행이 없습니다.</p>
          ) : (
            <ul className="message-list">
              {result.duplicates.map((duplicate) => (
                <li key={`${duplicate.sourceId}-${duplicate.rowId}`}>
                  <strong>{duplicate.rowId}</strong>
                  <span>{duplicate.duplicateOfRowId} 행과 중복</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="preview-section" aria-label="검증 경고">
          <h3>검증 경고 ({result.warnings.length})</h3>
          {result.warnings.length === 0 ? (
            <p className="empty-state">검증 경고가 없습니다.</p>
          ) : (
            <ul className="message-list warning-list">
              {result.warnings.map((warning, index) => (
                <li key={`${warning.sourceId}-${warning.code}-${index}`}>
                  <strong>{warning.sourceId}</strong>
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          취소
        </button>
        <button className="primary-button" type="button" onClick={onConfirm}>
          가져오기 확정
        </button>
      </div>
    </section>
  )
}
