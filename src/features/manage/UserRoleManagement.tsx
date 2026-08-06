import { useState } from 'react'
import { listUsers, saveUserRole } from '../auth/userStore'
import type { UserRole } from '../auth/authStore'

export default function UserRoleManagement() {
  const [users, setUsers] = useState(listUsers())
  const [employeeId, setEmployeeId] = useState('')
  const [role, setRole] = useState<UserRole>('viewer')
  function save() {
    const id = employeeId.trim()
    if (!id) return
    saveUserRole(id, role)
    setUsers(listUsers())
    setEmployeeId('')
  }
  return <section className="management-panel" aria-labelledby="user-role-title"><div className="panel-heading"><div><p className="eyebrow">Access Administration</p><h2 id="user-role-title">사용자 권한 지정</h2></div><p>사번별 메뉴 접근 권한을 지정합니다.</p></div><div className="inline-form"><label>사번<input aria-label="권한 지정 사번" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} /></label><label>권한<select aria-label="지정 권한" value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="viewer">임원/직책자/조회</option><option value="staff">실무담당자</option><option value="admin">관리자</option></select></label><button className="primary-button" type="button" onClick={save}>저장</button></div><table aria-label="사용자 권한 목록"><thead><tr><th>사번</th><th>권한</th></tr></thead><tbody>{users.map((user) => <tr key={user.employeeId}><th scope="row">{user.employeeId}</th><td>{user.role === 'admin' ? '관리자' : user.role === 'staff' ? '실무담당자' : '조회 전용'}</td></tr>)}</tbody></table></section>
}
