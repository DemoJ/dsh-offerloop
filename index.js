/**
 * OfferLoop (求职闭环) — Host half.
 *
 * Keeps one workspace-scoped JSON record (`.offerloop.json`), an authenticated
 * HTTP data route for the Client panel, and two Agent tools. The product loop is
 * target role (JD) → resume versions → mock interview → retrospective; there is
 * deliberately no evidence library.
 */
import { promises as fsp } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'

export const inject = ['webServer', 'connection', 'tools', 'systemPrompt', 'workspaceRegistry', 'workingDirectory']

const DATA_FILE = '.offerloop.json'
const STATE_VERSION = 2
const MAX_BODY = 2 * 1024 * 1024
const STAGES = new Set(['lead', 'applied', 'screen', 'interview', 'offer', 'closed'])
/** Extensions the file picker treats as resume documents (case-insensitive). */
const RESUME_EXTS = new Set(['.docx', '.doc', '.pdf', '.md', '.markdown', '.txt', '.rtf', '.odt', '.pages', '.html', '.htm'])
/** Upper bound for one directory listing served to the panel picker. */
const MAX_DIR_ENTRIES = 400
const ROUNDS = new Set(['一面', '二面', '三面', 'HR 面', '笔试', '终面', '其他', '业务面', '专业面', '压力面'])

const nowIso = () => new Date().toISOString()
const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`

function seedState() {
  const t = nowIso()
  return {
    version: STATE_VERSION,
    rev: 0,
    updatedAt: t,
    profile: { name: '', city: '', headline: '' },
    target: null,
    jobs: [],
    resumes: [
      {
        id: 'R-000',
        title: '我的简历（基线）',
        parentId: null,
        targetJobId: null,
        file: '',
        sections: [],
        diffSummary: [],
        exports: [],
        createdAt: t,
        updatedAt: t,
      },
    ],
    interviews: [],
    retros: [],
    todos: [],
  }
}

function normalizeState(raw) {
  const d = seedState()
  if (raw === null || typeof raw !== 'object') return d
  const state = {
    ...d,
    ...raw,
    version: STATE_VERSION,
    profile: { ...d.profile, ...(raw.profile && typeof raw.profile === 'object' ? raw.profile : {}) },
    target: raw.target && typeof raw.target === 'object' ? raw.target : null,
    jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
    resumes: Array.isArray(raw.resumes) ? raw.resumes : d.resumes,
    interviews: Array.isArray(raw.interviews) ? raw.interviews.map(normalizeInterview) : [],
    retros: Array.isArray(raw.retros) ? raw.retros : [],
    todos: Array.isArray(raw.todos) ? raw.todos : [],
  }
  if (typeof state.rev !== 'number') state.rev = 0
  const fromV1 = typeof raw.version === 'number' ? raw.version : 0
  // v1 carried an evidence library; the loop no longer owns one.
  delete state.evidence
  state.resumes = state.resumes.map((resume) => {
    if (!resume || typeof resume !== 'object') return resume
    const copy = { ...resume }
    delete copy.evidenceIds
    if (typeof copy.file !== 'string') copy.file = ''
    if (copy.id === 'R-000' && copy.title === '职业主线版（基线）') copy.title = '我的简历（基线）'
    return copy
  })
  if (fromV1 < 2) state.todos = state.todos.filter((todo) => !String(todo && todo.text ? todo.text : '').includes('导入现有'))
  return state
}

function normalizeInterview(item) {
  const interview = item && typeof item === 'object' ? item : {}
  return {
    ...interview,
    questions: Array.isArray(interview.questions) ? interview.questions : [],
    overall: interview.overall && typeof interview.overall === 'object' ? interview.overall : null,
  }
}

function workspaceList(ctx) {
  try {
    const list = ctx.workspaceRegistry.list()
    return list.map((w) => ({ id: String(w.id), title: String(w.title || w.path), path: String(w.path) }))
  } catch {
    return []
  }
}

function pickWorkspace(ctx, id, agent) {
  const list = workspaceList(ctx)
  if (typeof id === 'string' && id.length > 0) {
    const hit = list.find((w) => w.id === id)
    if (hit) return hit
  }
  const own = workspaceForAgent(ctx, agent)
  if (own !== null) return own
  if (list.length > 0) return list[0]
  const fallback = ctx.workingDirectory && ctx.workingDirectory.defaultDirectory
  if (typeof fallback === 'string' && fallback.length > 0) {
    const parts = fallback.split(/[\\/]/).filter(Boolean)
    return { id: 'default', title: parts[parts.length - 1] || fallback, path: fallback }
  }
  return null
}

const samePath = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)
const nestedIn = (target, base) => (process.platform === 'win32' ? target.toLowerCase().startsWith(base.toLowerCase() + sep) : target.startsWith(base + sep))

/**
 * The workspace a tool call belongs to: the calling session's own directory
 * (or a parent-registered workspace containing it), so Agent writes land in the
 * same data directory the user sees in the panel instead of an arbitrary first
 * workspace.
 */
function workspaceForAgent(ctx, agent) {
  try {
    const session = agent && typeof agent === 'object' ? agent.session : undefined
    if (session === undefined || session === null || !ctx.workingDirectory) return null
    const dir = ctx.workingDirectory.get(session)
    if (typeof dir !== 'string' || dir.length === 0) return null
    const target = resolve(dir)
    let best = null
    let bestLength = -1
    for (const entry of workspaceList(ctx)) {
      const base = resolve(entry.path)
      if (!samePath(target, base) && !nestedIn(target, base)) continue
      if (base.length > bestLength) {
        best = entry
        bestLength = base.length
      }
    }
    return best
  } catch {
    return null
  }
}

const queues = new Map()
function withLock(key, fn) {
  const prev = queues.get(key) || Promise.resolve()
  const run = prev.then(fn, fn)
  queues.set(key, run.catch(() => {}))
  return run
}

function dataPath(workspace) {
  return join(workspace.path, DATA_FILE)
}

/** Windows stores backslashes; the panel and the state file use one separator. */
const toPosix = (value) => value.split(sep).join('/')

/** Resolve one workspace-relative path, or null when it escapes the data directory. */
function resolveInside(workspace, relPath) {
  const base = resolve(workspace.path)
  const target = resolve(base, String(relPath || ''))
  if (target !== base && !target.startsWith(base + sep)) return null
  return target
}

/**
 * Validate a resume-file binding chosen in the panel. An empty value clears it;
 * anything else must be an existing regular file inside the data directory.
 * Returns the stored form (workspace-relative, forward slashes).
 */
async function normalizeResumeFile(workspace, value) {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string') throw new Error('简历文件必须是相对数据目录的路径')
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''
  if (trimmed.length > 500) throw new Error('简历文件路径过长（上限 500 字符）')
  const target = resolveInside(workspace, trimmed)
  if (target === null) throw new Error('简历文件必须位于当前数据目录内')
  let stat
  try {
    stat = await fsp.stat(target)
  } catch {
    throw new Error(`找不到简历文件：${trimmed}`)
  }
  if (!stat.isFile()) throw new Error(`不是文件：${trimmed}`)
  return toPosix(relative(resolve(workspace.path), target))
}

/** One directory level of the data directory, for the panel's resume-file picker. */
async function readDirectory(workspace, dir) {
  const target = resolveInside(workspace, dir)
  if (target === null) throw new Error('目录必须位于当前数据目录内')
  let stat
  try {
    stat = await fsp.stat(target)
  } catch {
    throw new Error('目录不存在')
  }
  if (!stat.isDirectory()) throw new Error('不是目录')
  const dirents = await fsp.readdir(target, { withFileTypes: true })
  const entries = []
  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) continue
    if (dirent.isDirectory()) entries.push({ name: dirent.name, kind: 'dir', resume: false })
    else if (dirent.isFile()) entries.push({ name: dirent.name, kind: 'file', resume: RESUME_EXTS.has(extname(dirent.name).toLowerCase()) })
    if (entries.length >= MAX_DIR_ENTRIES) break
  }
  entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'zh') : a.kind === 'dir' ? -1 : 1))
  const rel = toPosix(relative(resolve(workspace.path), target))
  const parent = rel === '' ? null : rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''
  return { dir: rel, parent, entries }
}

async function readState(workspace) {
  const file = dataPath(workspace)
  try {
    const text = await fsp.readFile(file, 'utf8')
    const parsed = JSON.parse(text)
    const state = normalizeState(parsed)
    const needsMigration =
      typeof parsed.version !== 'number' ||
      parsed.version !== STATE_VERSION ||
      Object.prototype.hasOwnProperty.call(parsed, 'evidence')
    if (needsMigration) {
      state.rev = (typeof state.rev === 'number' ? state.rev : 0) + 1
      state.updatedAt = nowIso()
      await writeState(workspace, state)
    }
    return state
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const state = seedState()
      await writeState(workspace, state)
      return state
    }
    if (error instanceof SyntaxError) {
      const backup = `${file}.corrupt-${Date.now()}`
      try {
        await fsp.rename(file, backup)
      } catch {
        /* best effort */
      }
      const state = seedState()
      state.warning = `数据文件无法解析，已备份为 ${backup}`
      await writeState(workspace, state)
      return state
    }
    throw error
  }
}

async function writeState(workspace, state) {
  const file = dataPath(workspace)
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  await fsp.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await fsp.rename(tmp, file)
}

async function mutateState(ctx, workspaceId, action, payload, agent) {
  const workspace = pickWorkspace(ctx, workspaceId, agent)
  if (workspace === null) throw new Error('没有可用的数据目录：请先在侧边栏打开一个工作区')
  return withLock(workspace.path, async () => {
    const state = await readState(workspace)
    const nextPayload = { ...(payload && typeof payload === 'object' ? payload : {}) }
    if ((action === 'resume.add' || action === 'resume.update') && Object.prototype.hasOwnProperty.call(nextPayload, 'file')) {
      nextPayload.file = await normalizeResumeFile(workspace, nextPayload.file)
    }
    applyAction(state, action, nextPayload)
    state.rev = (typeof state.rev === 'number' ? state.rev : 0) + 1
    state.updatedAt = nowIso()
    await writeState(workspace, state)
    return { workspace, state }
  })
}

const asText = (value, max = 20000) => (typeof value === 'string' ? value.slice(0, max) : '')
const asList = (value, max = 60) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, max).map((item) => item.slice(0, 1000)) : []

function sanitizeSections(value) {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 40)
    .map((section) => {
      const source = section && typeof section === 'object' ? section : {}
      const bullets = Array.isArray(source.bullets)
        ? source.bullets
            .slice(0, 40)
            .map((bullet) => {
              const item = bullet && typeof bullet === 'object' ? bullet : { text: bullet }
              return typeof item === 'string' ? { text: asText(item, 1000) } : { text: asText(item.text, 1000) }
            })
            .filter((bullet) => bullet.text.length > 0)
        : []
      return { heading: asText(source.heading, 120), bullets }
    })
    .filter((section) => section.heading.length > 0 || section.bullets.length > 0)
}

function sanitizeQuestions(value) {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 40)
    .map((question) => {
      const item = question && typeof question === 'object' ? question : { q: question }
      return {
        q: asText(item.q || item.question, 2000),
        a: asText(item.a || item.answer, 8000),
        score: asText(item.score, 20),
        dimension: asText(item.dimension, 60),
        comment: asText(item.comment || item.analysis, 2000),
      }
    })
    .filter((question) => question.q.length > 0)
}

function sanitizeOverall(value) {
  if (!value || typeof value !== 'object') return null
  return {
    score: asText(value.score, 20),
    summary: asText(value.summary, 3000),
    strengths: asList(value.strengths, 20),
    gaps: asList(value.gaps, 20),
  }
}

function applyAction(state, action, payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  switch (action) {
    case 'target.set': {
      const title = asText(p.title, 200)
      const company = asText(p.company, 200)
      const jd = asText(p.jd, 20000)
      if (title.length === 0 && jd.length === 0) throw new Error('目标岗位至少需要标题或 JD 文本')
      state.target = {
        id: uid('T'),
        title: title.length > 0 ? title : '目标岗位',
        company,
        jd,
        source: asText(p.source, 20) || 'text',
        updatedAt: nowIso(),
      }
      return
    }
    case 'target.clear': {
      state.target = null
      return
    }
    case 'job.add': {
      const title = asText(p.title, 200)
      if (title.length === 0) throw new Error('岗位标题不能为空')
      state.jobs.unshift({
        id: uid('J'),
        title,
        company: asText(p.company, 200),
        jd: asText(p.jd, 20000),
        source: asText(p.source, 30),
        stage: STAGES.has(p.stage) ? p.stage : 'lead',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
      return
    }
    case 'job.update': {
      const job = state.jobs.find((item) => item.id === p.id)
      if (!job) throw new Error('岗位不存在')
      const patch = p.patch && typeof p.patch === 'object' ? p.patch : {}
      if (typeof patch.title === 'string') job.title = asText(patch.title, 200)
      if (typeof patch.company === 'string') job.company = asText(patch.company, 200)
      if (typeof patch.jd === 'string') job.jd = asText(patch.jd, 20000)
      if (typeof patch.stage === 'string' && STAGES.has(patch.stage)) job.stage = patch.stage
      job.updatedAt = nowIso()
      return
    }
    case 'job.delete': {
      state.jobs = state.jobs.filter((item) => item.id !== p.id)
      return
    }
    case 'resume.add': {
      const title = asText(p.title, 200)
      if (title.length === 0) throw new Error('简历版本标题不能为空')
      state.resumes.unshift({
        id: uid('R'),
        title,
        parentId: typeof p.parentId === 'string' && p.parentId.length > 0 ? p.parentId : null,
        targetJobId: typeof p.targetJobId === 'string' && p.targetJobId.length > 0 ? p.targetJobId : null,
        file: asText(p.file, 500),
        sections: [],
        diffSummary: [],
        exports: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
      return
    }
    case 'resume.update': {
      const version = state.resumes.find((item) => item.id === p.id)
      if (!version) throw new Error('简历版本不存在')
      if (typeof p.title === 'string' && p.title.trim().length > 0) version.title = asText(p.title, 200)
      if (typeof p.parentId === 'string') version.parentId = p.parentId.length > 0 ? p.parentId : null
      if (typeof p.targetJobId === 'string') version.targetJobId = p.targetJobId.length > 0 ? p.targetJobId : null
      if (typeof p.file === 'string') version.file = asText(p.file, 500)
      if (Array.isArray(p.sections)) version.sections = sanitizeSections(p.sections)
      if (Array.isArray(p.diffSummary)) version.diffSummary = asList(p.diffSummary, 20)
      version.updatedAt = nowIso()
      return
    }
    case 'resume.delete': {
      state.resumes = state.resumes.filter((item) => item.id !== p.id)
      return
    }
    case 'interview.add': {
      const jobId = typeof p.jobId === 'string' ? p.jobId : ''
      const job = jobId ? state.jobs.find((item) => item.id === jobId) : null
      state.interviews.unshift({
        id: uid('I'),
        jobId,
        jobTitle: asText(p.jobTitle, 200) || (job ? job.title : state.target ? state.target.title : ''),
        round: ROUNDS.has(p.round) ? p.round : '其他',
        type: asText(p.type, 40) || '业务面',
        mode: p.mode === 'mock' ? 'mock' : 'real',
        notes: asText(p.notes, 8000),
        questions: sanitizeQuestions(p.questions),
        overall: sanitizeOverall(p.overall),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
      return
    }
    case 'interview.update': {
      const interview = state.interviews.find((item) => item.id === p.id)
      if (!interview) throw new Error('面试记录不存在')
      if (typeof p.jobId === 'string') interview.jobId = p.jobId
      if (typeof p.jobTitle === 'string') interview.jobTitle = asText(p.jobTitle, 200)
      if (typeof p.round === 'string' && ROUNDS.has(p.round)) interview.round = p.round
      if (typeof p.type === 'string') interview.type = asText(p.type, 40)
      if (typeof p.notes === 'string') interview.notes = asText(p.notes, 8000)
      if (Array.isArray(p.questions)) interview.questions = sanitizeQuestions(p.questions)
      if (p.overall !== undefined) interview.overall = sanitizeOverall(p.overall)
      interview.updatedAt = nowIso()
      return
    }
    case 'interview.delete': {
      state.interviews = state.interviews.filter((item) => item.id !== p.id)
      return
    }
    case 'retro.add': {
      state.retros.unshift({
        id: uid('B'),
        interviewId: typeof p.interviewId === 'string' ? p.interviewId : '',
        worked: asText(p.worked, 4000),
        broke: asText(p.broke, 4000),
        gaps: asList(p.gaps, 40),
        actions: asList(p.actions, 40),
        createdAt: nowIso(),
      })
      return
    }
    case 'retro.delete': {
      state.retros = state.retros.filter((item) => item.id !== p.id)
      return
    }
    case 'todo.add': {
      const text = asText(p.text, 300)
      if (text.length === 0) throw new Error('待办内容不能为空')
      state.todos.unshift({ id: uid('D'), text, done: false, createdAt: nowIso() })
      return
    }
    case 'todo.toggle': {
      const todo = state.todos.find((item) => item.id === p.id)
      if (todo) todo.done = !todo.done
      return
    }
    case 'todo.delete': {
      state.todos = state.todos.filter((item) => item.id !== p.id)
      return
    }
    default:
      throw new Error(`未知操作：${String(action)}`)
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function createHandler(ctx) {
  return async function handler(req, res) {
    try {
      const rejection = typeof ctx.connection?.requestRejection === 'function' ? ctx.connection.requestRejection({ headers: req.headers }) : undefined
      if (rejection !== undefined) {
        sendJson(res, rejection, { ok: false, error: 'unauthorized' })
        return
      }
      const url = new URL(req.url || '/', 'http://localhost')
      const path = url.pathname.replace(/^\/offerloop\/api/, '') || '/'
      const method = (req.method || 'GET').toUpperCase()

      if (method === 'GET' && (path === '/' || path === '/ping')) {
        sendJson(res, 200, { ok: true, plugin: 'offerloop' })
        return
      }
      if (method === 'GET' && path === '/bootstrap') {
        const workspaces = workspaceList(ctx)
        const workspace = pickWorkspace(ctx, url.searchParams.get('ws'))
        if (workspace === null) {
          sendJson(res, 200, { ok: true, plugin: 'offerloop', workspaces, ws: '', workspace: null, state: null })
          return
        }
        const state = await readState(workspace)
        sendJson(res, 200, { ok: true, plugin: 'offerloop', workspaces, ws: workspace.id, workspace: { id: workspace.id, title: workspace.title, path: workspace.path }, state })
        return
      }
      if (method === 'GET' && path === '/files') {
        const workspace = pickWorkspace(ctx, url.searchParams.get('ws'))
        if (workspace === null) {
          sendJson(res, 200, { ok: true, ws: '', workspace: null, dir: '', parent: null, entries: [] })
          return
        }
        const listing = await readDirectory(workspace, url.searchParams.get('dir') || '')
        sendJson(res, 200, {
          ok: true,
          ws: workspace.id,
          workspace: { id: workspace.id, title: workspace.title, path: workspace.path },
          ...listing,
        })
        return
      }
      if (method === 'POST' && path === '/action') {
        const raw = await readBody(req)
        const body = raw.trim().length > 0 ? JSON.parse(raw) : {}
        const result = await mutateState(ctx, body.ws, body.action, body.payload)
        sendJson(res, 200, {
          ok: true,
          workspaces: workspaceList(ctx),
          ws: result.workspace.id,
          workspace: { id: result.workspace.id, title: result.workspace.title, path: result.workspace.path },
          state: result.state,
        })
        return
      }
      sendJson(res, 404, { ok: false, error: 'not-found', path })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

const WRITE_ACTIONS = new Set([
  'target.set',
  'target.clear',
  'job.add',
  'job.update',
  'job.delete',
  'resume.add',
  'resume.update',
  'resume.delete',
  'interview.add',
  'interview.update',
  'interview.delete',
  'retro.add',
  'retro.delete',
  'todo.add',
  'todo.toggle',
  'todo.delete',
])

const PROMPT_SECTION = [
  '求职台 OfferLoop 已启用。用户求职数据保存在当前 workspace 的 `.offerloop.json`（不要直接手改该文件）。',
  '「数据目录」就是当前 workspace：数据只写在这个文件夹里，换一个 workspace 等于换一套求职数据；不要读写其他 workspace 的数据文件。',
  '两个工具默认读写你当前会话所在的 workspace（数据目录）；用户明确指定 workspace 时才用指定值。',
  '读取目标岗位、岗位库、简历版本、面试记录与复盘：调用 offerloop_read。',
  '写入目标岗位、简历版本、面试与复盘：调用 offerloop_write（action 与 payload 见工具说明）。',
  '目标岗位可以来自文字或 JD 截图：用户发来 JD 图片时，先读图提取岗位标题、公司、关键要求与考点，再用 offerloop_write 的 target.set 保存，jd 字段保留原文要点。',
  '简历版本的 file 字段是用户在面板里挑选的简历文件（相对数据目录）：用户要改简历或准备模拟面试时，先按这个路径读取那份文件的实际内容（docx/pdf 用 office 技能），再按用户给的修改点处理；file 为空时只维护面板里的结构化简历，不要自行寻找、导入或改写其他简历文档。',
  '用户不会维护证据库。修改简历时，用户会在对话里直接给出修改点：按修改点用 resume.update 写入对应版本，不擅自补造经历或数字；不要读取或导入当前文件夹里的旧简历文档，除非用户明确要求。',
  '模拟面试：基于目标岗位 JD 与简历版本随机出题，一次一问、逐题追问，答完后给档位、维度与点评，并用 interview.add（mode=mock）保存；真实面试后按三段式复盘并用 retro.add 保存。',
].join('\n')

export function apply(ctx) {
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/offerloop/api',
      handler: createHandler(ctx),
    }),
  )

  ctx.effect(() =>
    ctx.tools.register({
      name: 'offerloop_read',
      description:
        'Read the OfferLoop job-search state saved in the current workspace: target role, jobs, resume versions, interviews (including mock scores) and retrospectives. Use it before editing a resume or running an interview simulation.',
      parameters: {
        type: 'object',
        properties: {
          workspace: { type: 'string', description: 'Workspace id; omit to use the workspace of the current session (the data directory shown in the panel).' },
          part: {
            type: 'string',
            enum: ['all', 'target', 'jobs', 'resumes', 'interviews', 'retros', 'todos', 'profile'],
            description: 'Which part to read; all is the full state.',
          },
        },
        additionalProperties: false,
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: String(value) }],
      },
      async execute(args, exec) {
        const workspace = pickWorkspace(ctx, args && args.workspace, exec && exec.agent)
        if (workspace === null) throw new Error('没有可用的数据目录')
        const state = await readState(workspace)
        const part = args && typeof args.part === 'string' ? args.part : 'all'
        const view = part === 'all' ? state : state[part] ?? null
        return JSON.stringify({ workspace: { id: workspace.id, title: workspace.title, path: workspace.path }, part, value: view }, null, 2)
      },
    }),
  )

  ctx.effect(() =>
    ctx.tools.register({
      name: 'offerloop_write',
      description:
        'Write OfferLoop job-search state: set the target role (text or a parsed JD image), manage jobs, create or update resume versions (including which resume file each version points at), save mock-interview questions with scores, and save post-interview retrospectives. Every call validates and rewrites the workspace .offerloop.json file.',
      parameters: {
        type: 'object',
        properties: {
          workspace: { type: 'string', description: 'Workspace id; omit to use the workspace of the current session (the data directory shown in the panel).' },
          action: {
            type: 'string',
            enum: [...WRITE_ACTIONS],
            description: 'Mutation to apply.',
          },
          payload: { type: 'object', additionalProperties: true, description: 'Action payload; see the plugin panel forms for field names.' },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: String(value) }],
      },
      async execute(args, exec) {
        if (!args || typeof args.action !== 'string' || !WRITE_ACTIONS.has(args.action)) throw new Error('未知或缺少 action')
        const result = await mutateState(ctx, args.workspace, args.action, args.payload, exec && exec.agent)
        const state = result.state
        const summary = {
          target: state.target ? `${state.target.title}${state.target.company ? ' @ ' + state.target.company : ''}` : null,
          counts: {
            jobs: state.jobs.length,
            resumes: state.resumes.length,
            interviews: state.interviews.length,
            retros: state.retros.length,
          },
        }
        return `已写入 ${args.action}（workspace: ${result.workspace.title}）。\n${JSON.stringify(summary, null, 2)}`
      },
    }),
  )

  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: 'offerloop',
      order: 60,
      text: PROMPT_SECTION,
    }),
  )
}