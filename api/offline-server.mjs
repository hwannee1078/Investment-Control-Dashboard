import { createServer } from 'node:http'
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import pg from 'pg'

const { Pool } = pg
const scrypt = promisify(scryptCallback)
const port = Number(process.env.PORT ?? 3000)
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET is required')

const pool = new Pool({
  host: process.env.PGHOST ?? 'db',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'investment',
  user: process.env.POSTGRES_USER ?? 'investment_app',
  password: process.env.POSTGRES_PASSWORD,
})

const seedUsers = [
  { employeeId: '123456', password: '123456', role: 'viewer' },
  { employeeId: '1111', password: '1111', role: 'staff' },
  { employeeId: 'admin', password: 'admin', role: 'admin' },
]

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`
}

async function verifyPassword(password, encoded) {
  const [, salt, expectedHex] = String(encoded).split(':')
  if (!salt || !expectedHex) return false
  const actual = Buffer.from(await scrypt(password, salt, 64))
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function encodeToken(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, employeeId: user.employee_id, role: user.role, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url')
  const signature = createHmac('sha256', jwtSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function decodeToken(request) {
  const value = request.headers.authorization ?? ''
  const token = value.startsWith('Bearer ') ? value.slice(7) : ''
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', jwtSecret).update(payload).digest('base64url')
  if (signature !== expected) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return parsed.exp > Date.now() ? parsed : null
  } catch { return null }
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function seed() {
  for (const user of seedUsers) {
    const passwordHash = await hashPassword(user.password)
    await pool.query(
      `insert into app_users (employee_id, password_hash, role)
       values ($1, $2, $3)
       on conflict (employee_id) do nothing`,
      [user.employeeId, passwordHash, user.role],
    )
  }
}

async function listData() {
  const [projects, transactions, mappings, finalizations, importBatches] = await Promise.all([
    pool.query('select id, data from projects order by id'),
    pool.query('select source_id, row_id, data from investment_transactions order by source_id, row_id'),
    pool.query('select order_id, project_id from order_mappings order by order_id'),
    pool.query('select project_id, finalized from project_finalizations where finalized = true'),
    pool.query('select data from import_batches order by uploaded_at desc'),
  ])
  return {
    projects: projects.rows.map((row) => row.data),
    transactions: transactions.rows.map((row) => row.data),
    mappings: Object.fromEntries(mappings.rows.map((row) => [row.order_id, row.project_id])),
    finalizations: Object.fromEntries(finalizations.rows.map((row) => [row.project_id, row.finalized])),
    importBatches: importBatches.rows.map((row) => row.data),
  }
}

async function syncData(body) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    for (const data of body.projects ?? []) await client.query('insert into projects (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data, updated_at = now()', [data.id, data])
    for (const data of body.transactions ?? []) await client.query('insert into investment_transactions (source_id, row_id, data) values ($1, $2, $3) on conflict (source_id, row_id) do update set data = excluded.data, updated_at = now()', [data.sourceId, data.rowId, data])
    for (const [orderId, projectId] of Object.entries(body.mappings ?? {})) await client.query('insert into order_mappings (order_id, project_id) values ($1, $2) on conflict (order_id) do update set project_id = excluded.project_id, updated_at = now()', [orderId, projectId])
    for (const [projectId, finalized] of Object.entries(body.finalizations ?? {})) await client.query('insert into project_finalizations (project_id, finalized) values ($1, $2) on conflict (project_id) do update set finalized = excluded.finalized, updated_at = now()', [projectId, finalized])
    for (const batch of body.importBatches ?? []) await client.query('insert into import_batches (id, uploaded_at, data) values ($1, $2, $3) on conflict (id) do update set data = excluded.data, uploaded_at = excluded.uploaded_at', [batch.id, batch.uploadedAt, batch])
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally { client.release() }
}

async function safetyAnswer(question) {
  const terms = Array.from(new Set(String(question).split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= 2))).slice(0, 8)
  if (terms.length === 0) terms.push(String(question).slice(0, 120))
  const patterns = terms.map((term) => `%${term}%`)
  const result = await pool.query(
    `select d.id as document_id, d.title, d.source_group, d.source_name, d.url, d.source_date,
            c.section, c.page, c.content, c.keywords
       from safety_documents d
       join safety_document_chunks c on c.document_id = d.id
      where d.status = 'approved'
      order by d.source_date desc nulls last`,
    [],
  )
  let rows = result.rows.filter((row) => {
    const haystack = `${row.content} ${(row.keywords ?? []).join(' ')}`
    return terms.some((term) => haystack.includes(term))
  }).slice(0, 3)
  if (rows.length === 0) {
    const text = String(question)
    const fallbackIds = text.includes('화학') || text.includes('보호구')
      ? new Set(['kosha-chemical-guide'])
      : text.includes('위험성평가') || text.includes('위험성')
        ? new Set(['law-occupational-safety', 'ministry-risk-assessment'])
        : new Set()
    rows = result.rows.filter((row) => fallbackIds.has(row.document_id)).slice(0, 3)
  }
  if (rows.length === 0) {
    return {
      question,
      answer: '현재 오프라인 승인 문서에서 질문과 일치하는 근거를 찾지 못했습니다. 안전·법무 담당자에게 최신 기준을 확인해 주세요.',
      intent: 'safety-search',
      hasEvidence: false,
      citations: [],
      evidence: [],
    }
  }
  return {
    question,
    answer: `승인된 공식 문서에서 확인된 내용입니다.\n\n${rows.map((row) => row.content).join('\n\n')}\n\n실제 적용 전에는 원문과 최신 개정 여부를 확인하세요.`,
    intent: 'safety-search',
    hasEvidence: true,
    evidence: rows.map((row) => ({ content: row.content, section: row.section, page: row.page })),
    citations: rows.map((row) => ({ documentId: row.document_id, title: row.title, sourceGroup: row.source_group, sourceName: row.source_name, section: row.section, page: row.page, sourceDate: row.source_date, url: row.url, status: 'approved' })),
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (request.method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/api/offline/healthz')) return send(response, 200, { ok: true })
    if (request.method === 'POST' && url.pathname === '/api/offline/login') {
      const body = await readJson(request)
      const result = await pool.query('select id, employee_id, password_hash, role from app_users where employee_id = $1 and active = true', [String(body.employeeId ?? '')])
      const user = result.rows[0]
      if (!user || !(await verifyPassword(String(body.password ?? ''), user.password_hash))) return send(response, 401, { message: '사번 또는 비밀번호가 올바르지 않습니다.' })
      return send(response, 200, { token: encodeToken(user), role: user.role })
    }
    const user = decodeToken(request)
    if (!user) return send(response, 401, { message: '인증이 필요합니다.' })
    if (request.method === 'GET' && url.pathname === '/api/offline/bootstrap') return send(response, 200, await listData())
    if (request.method === 'POST' && url.pathname === '/api/offline/agent') {
      const body = await readJson(request)
      const question = [...(body.conversation ?? [])].reverse().find((message) => message?.role === 'user')?.content
      if (typeof question !== 'string' || !question.trim()) return send(response, 400, { message: '질문이 필요합니다.' })
      return send(response, 200, { message: await safetyAnswer(question), toolTrace: [{ name: 'safetySearch', status: 'ok' }] })
    }
    if (request.method === 'POST' && url.pathname === '/api/offline/sync') {
      if (!['staff', 'admin'].includes(user.role)) return send(response, 403, { message: '자료 수정 권한이 없습니다.' })
      await syncData(await readJson(request))
      return send(response, 204, {})
    }
    return send(response, 404, { message: 'Not found' })
  } catch (error) {
    console.error(error)
    return send(response, 500, { message: '내부 API 오류가 발생했습니다.' })
  }
})

await seed()
server.listen(port, '0.0.0.0', () => console.log(`offline API listening on ${port}`))
