import type { Project } from '../../domain/project'

type OrderMappingTableProps = {
  orders: string[]
  projects: Project[]
  onMap: (orderId: string, projectId: string) => void
}

export default function OrderMappingTable({
  orders,
  projects,
  onMap,
}: OrderMappingTableProps) {
  return (
    <section className="preview-section mapping-section" aria-label="미연결 오더">
      <h3>미연결 오더 ({orders.length})</h3>
      {orders.length === 0 ? (
        <p className="empty-state">모든 투자오더가 사업에 연결되었습니다.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">투자오더번호</th>
                <th scope="col">연결 사업</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((orderId) => (
                <tr key={orderId}>
                  <th scope="row">{orderId}</th>
                  <td>
                    <label className="visually-hidden" htmlFor={`mapping-${orderId}`}>
                      {orderId} 연결 사업
                    </label>
                    <select
                      id={`mapping-${orderId}`}
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value !== '') {
                          onMap(orderId, event.target.value)
                        }
                      }}
                    >
                      <option value="">사업 선택</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
