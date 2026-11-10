/**
 * OfferLoop (求职闭环) — Client half.
 *
 * Sidebar entry + full central panel. Loop: target JD → resume versions →
 * mock interview (random questions scored) → retrospective. No evidence library.
 * Data comes from the Host half's authenticated `/offerloop/api` route.
 */
window.__ModuleLoader__.load({
  id: 'dsh-offerloop',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const STAGES = { lead: '线索', applied: '已投递', screen: '沟通中', interview: '面试中', offer: 'Offer', closed: '已关闭' }
    const ROUNDS = ['一面', '二面', '三面', 'HR 面', '笔试', '终面', '业务面', '专业面', '压力面', '其他']
    const SCORE_KIND = { A: 'pub', B: 'ok', C: 'self', D: 'gap' }

    const CSS = `
.olp-wrap{height:100%;overflow:auto;box-sizing:border-box;padding:18px 24px 56px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}
.olp-wrap *{box-sizing:border-box}
.olp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.olp-title{display:flex;align-items:center;gap:10px;min-width:0}
.olp-title h1{font-size:19px;margin:0;letter-spacing:-.01em;line-height:1.3}
.olp-title p{margin:1px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.olp-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.olp-btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
.olp-btn:hover{border-color:var(--dsw-alias-border-l2)}
.olp-btn:disabled{opacity:.55;cursor:default}
.olp-btn.pri{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
.olp-btn.pri:hover{filter:brightness(.94)}
.olp-btn.pri:disabled{opacity:1;background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-weight:400}
.olp-btn.quiet{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}
.olp-btn.quiet:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.olp-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px}
.olp-tabrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 16px}
.olp-tabs{display:flex;gap:2px;flex-wrap:wrap;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:3px}
.olp-tab{background:none;border:none;border-radius:7px;color:var(--dsw-alias-label-secondary);padding:5px 12px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
.olp-tab:hover{color:var(--dsw-alias-label-primary)}
.olp-tab.on{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}
.olp-tchip{margin-left:auto;display:inline-flex;align-items:center;gap:8px;max-width:min(440px,100%);min-width:0;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:999px;padding:5px 12px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left}
.olp-tchip:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.olp-tchip.empty{border-style:dashed}
.olp-tchip.open{border-color:var(--dsw-alias-brand-primary)}
.olp-tchip-label{color:var(--dsw-alias-label-secondary);font-size:11.5px;white-space:nowrap}
.olp-tchip-value{font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.olp-tchip.empty .olp-tchip-value{font-weight:500;color:var(--dsw-alias-label-secondary)}
.olp-tchip-edit{flex:0 0 auto;font-size:11.5px;color:var(--dsw-alias-label-secondary);border-left:1px solid var(--dsw-alias-border-l1);padding-left:8px;white-space:nowrap}
.olp-tchip:hover .olp-tchip-edit{color:var(--dsw-alias-label-primary)}
.olp-teditor{margin:0 0 16px}
.olp-teditor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.olp-teditor-title{font-size:15px;margin:0 0 2px}
.olp-teditor-head .olp-hint{margin:0}
.olp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}
.olp-stat{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px}
.olp-stat b{display:block;font-size:22px;line-height:1.2}
.olp-stat span{font-size:12px;color:var(--dsw-alias-label-secondary)}
.olp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.olp-item{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.olp-item-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.olp-item h3{font-size:14px;margin:0;font-weight:600;word-break:break-word}
.olp-item p{margin:0;font-size:12.5px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.olp-meta{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:11.5px;color:var(--dsw-alias-label-secondary);align-items:center}
.olp-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.olp-badge.pub{color:var(--dsw-alias-state-success-primary)}
.olp-badge.self{color:var(--dsw-alias-state-warn-primary)}
.olp-badge.ok{color:var(--dsw-alias-brand-primary)}
.olp-badge.gap{color:var(--dsw-alias-state-error-primary)}
.olp-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 12px;margin-bottom:14px}
.olp-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.olp-field>span{font-size:12px;color:var(--dsw-alias-label-secondary)}
.olp-field.wide{grid-column:1/-1}
.olp-in,.olp-ta,.olp-sel{width:100%;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 9px;font:inherit;font-size:13px}
.olp-in:focus,.olp-ta:focus,.olp-sel:focus{outline:1px solid var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.olp-ta{min-height:80px;resize:vertical;line-height:1.55}
.olp-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.olp-todo{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:13px}
.olp-todo:last-child{border-bottom:none}
.olp-todo input{accent-color:var(--dsw-alias-brand-primary)}
.olp-todo.done span{color:var(--dsw-alias-label-secondary);text-decoration:line-through}
.olp-todo span{flex:1;word-break:break-word}
.olp-empty{border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:18px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}
.olp-notice{border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.olp-notice.err{color:var(--dsw-alias-state-error-primary)}
.olp-notice.ok{color:var(--dsw-alias-state-success-primary)}
.olp-split{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.olp-sec-title{font-size:13px;font-weight:600;margin:0 0 8px}
.olp-hint{font-size:12px;color:var(--dsw-alias-label-secondary);margin:6px 0 0}
.olp-loading{display:flex;align-items:center;justify-content:center;height:100%;color:var(--dsw-alias-label-secondary);font-size:13px}
.olp-error{border:1px solid var(--dsw-alias-state-error-primary);border-radius:12px;padding:16px;color:var(--dsw-alias-label-primary);font-size:13.5px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.olp-q{border-left:2px solid var(--dsw-alias-border-l2);padding-left:10px;margin-top:8px;display:flex;flex-direction:column;gap:3px}
.olp-q b{font-size:12.5px;line-height:1.5}
.olp-q .a{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap}
.olp-q .c{font-size:12px;color:var(--dsw-alias-label-secondary)}
.olp-ctx{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:10px}
.olp-dirlabel{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.olp-file{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary);margin:2px 0 0;min-width:0}
.olp-file b{color:var(--dsw-alias-label-primary);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.olp-pickpage{display:flex;flex-direction:column;gap:12px;padding:16px 18px}
.olp-pick-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.olp-pick-title{font-size:16px;margin:0 0 2px;letter-spacing:-.01em}
.olp-pick-head .olp-hint{margin:0}
.olp-pick-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.olp-pick-crumbs{display:flex;align-items:center;gap:2px;flex-wrap:wrap;font-size:12px;min-width:0}
.olp-pick-crumb-wrap{display:inline-flex;align-items:center;gap:2px;min-width:0}
.olp-pick-sep{color:var(--dsw-alias-label-secondary);font-size:11px}
.olp-pick-crumb{border:1px solid transparent;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.olp-pick-crumb:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.olp-pick-crumb.last{color:var(--dsw-alias-label-primary);font-weight:600}
.olp-pick-search{margin-left:auto;width:220px;max-width:100%;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:5px 10px;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px}
.olp-pick-search:focus{outline:1px solid var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.olp-pick-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary)}
.olp-check{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.olp-pick-list{max-height:min(52vh,460px);overflow:auto;display:flex;flex-direction:column;gap:1px;padding:4px 2px;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1)}
.olp-pick-row{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:1px solid transparent;border-radius:7px;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.45;text-align:left;cursor:pointer}
.olp-pick-row:hover{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}
.olp-pick-row.on{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-brand-primary)}
.olp-pick-ico{flex:0 0 auto;font-size:14px;line-height:1}
.olp-pick-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.olp-pick-tag{margin-left:auto;flex:0 0 auto;font-size:10.5px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 7px}
.olp-pick-tag.on{color:var(--dsw-alias-bg-base);background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);font-weight:600}
.olp-pick-empty{padding:26px 12px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.olp-pick-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.olp-pick-sel{flex:1;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.olp-pick-sel.set{color:var(--dsw-alias-label-primary)}
.olp-file-name{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom}
@media (max-width:820px){.olp-wrap{padding:14px 14px 48px}.olp-form{grid-template-columns:1fr}}
`

    const splitPath = (value) => String(value || '').split('/').filter(Boolean)
    const baseNameOf = (value) => {
      const parts = splitPath(value)
      return parts.length > 0 ? parts[parts.length - 1] : ''
    }
    const dirNameOf = (value) => {
      const parts = splitPath(value)
      parts.pop()
      return parts.join('/')
    }

    function Icon(props) {
      const size = props.size || 20
      return h(
        'svg',
        { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true, style: { display: 'block', flex: '0 0 auto' } },
        h('rect', { x: 2, y: 2, width: 60, height: 60, rx: 16, fill: props.active ? '#1d4ed8' : '#3b7bff' }),
        h('rect', { x: 15, y: 24, width: 34, height: 24, rx: 5, fill: '#ffffff', opacity: 0.96 }),
        h('path', { d: 'M25 24v-3.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4V24', fill: 'none', stroke: '#ffffff', strokeWidth: 3.2, strokeLinecap: 'round', opacity: 0.96 }),
        h('path', { d: 'M24 36l4.2 4.2L40 29.5', fill: 'none', stroke: '#1d4ed8', strokeWidth: 3.6, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    function PanelIcon(props) {
      return h(Icon, { size: props && props.size ? props.size : 20, active: props && props.active })
    }

    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      render() {
        if (this.state.error) {
          return h(
            'div',
            { className: 'olp-wrap' },
            h('div', { className: 'olp-error' }, h('b', null, '求职台渲染出错'), h('span', null, String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)), h('button', { className: 'olp-btn', onClick: () => this.setState({ error: null }) }, '重试')),
          )
        }
        return this.props.children
      }
    }

    async function callBootstrap(wsId) {
      const query = wsId ? '?ws=' + encodeURIComponent(wsId) : ''
      const response = await fetch('/offerloop/api/bootstrap' + query, { headers: { accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) throw new Error(data.error || 'HTTP ' + response.status)
      return data
    }

    function Badge(props) {
      return h('span', { className: 'olp-badge ' + (props.kind || '') }, props.children)
    }

    function Field(props) {
      return h('label', { className: 'olp-field' + (props.wide ? ' wide' : '') }, h('span', null, props.label), props.children)
    }

    function TargetChip(props) {
      const { target, open, onToggle } = props
      const value = target ? target.title + (target.company ? ' @ ' + target.company : '') : '未设置'
      return h(
        'button',
        {
          className: 'olp-tchip' + (target ? '' : ' empty') + (open ? ' open' : ''),
          title: target ? value + ' · 点击编辑' : '还没有目标岗位；点一下设置，模拟面试才有针对性',
          onClick: onToggle,
        },
        h('span', { className: 'olp-tchip-label' }, '目标岗位'),
        h('span', { className: 'olp-tchip-value' }, value),
        h('span', { className: 'olp-tchip-edit' }, open ? '收起' : target ? '编辑' : '设置'),
      )
    }

    function TargetEditor(props) {
      const { target, busy, onSave, onClear, onOpenChat, onClose } = props
      const [title, setTitle] = useState(target ? target.title : '')
      const [company, setCompany] = useState(target ? target.company : '')
      const [jd, setJd] = useState(target ? target.jd : '')
      const canSave = title.trim() !== '' || jd.trim() !== ''
      async function save() {
        if (!canSave) return
        const ok = await onSave({ title: title.trim(), company: company.trim(), jd: jd.trim(), source: 'text' })
        if (ok !== false) onClose()
      }
      return h(
        'section',
        { className: 'olp-card olp-teditor' },
        h(
          'div',
          { className: 'olp-teditor-head' },
          h(
            'div',
            null,
            h('h2', { className: 'olp-teditor-title' }, target ? '编辑目标岗位' : '设置目标岗位'),
            h('p', { className: 'olp-hint' }, '目标岗位是模拟面试和简历定制的主线：粘贴 JD 文字，或把 JD 截图发给助手解析。'),
          ),
          h('button', { className: 'olp-btn quiet', onClick: onClose }, '收起'),
        ),
        h(
          'div',
          { className: 'olp-form' },
          h(Field, { label: '岗位标题' }, h('input', { className: 'olp-in', value: title, placeholder: '如：AI 产品经理', onChange: (e) => setTitle(e.target.value) })),
          h(Field, { label: '公司' }, h('input', { className: 'olp-in', value: company, placeholder: '如：某科技公司', onChange: (e) => setCompany(e.target.value) })),
          h(Field, { label: 'JD 原文 / 关键要求', wide: true }, h('textarea', { className: 'olp-ta', value: jd, placeholder: '把 JD 文字贴进来，或只写关键要求；之后可以随时改。', onChange: (e) => setJd(e.target.value) })),
          h(
            'div',
            { className: 'olp-row', style: { gridColumn: '1/-1' } },
            h('button', { className: 'olp-btn pri', disabled: busy || !canSave, onClick: save }, '保存目标岗位'),
            h(
              'button',
              { className: 'olp-btn', onClick: () => onOpenChat('我要用一张 JD 截图设置目标岗位。请先让我粘贴图片，然后读取图片里的岗位标题、公司、关键要求与面试考点，提取成结构化信息后用 offerloop_write 的 target.set 保存（source 记为 image）。') },
              '用截图设置',
            ),
            target
              ? h(
                  'button',
                  {
                    className: 'olp-btn',
                    onClick: () => {
                      onOpenChat('这是当前目标岗位：' + target.title + (target.company ? ' @ ' + target.company : '') + '。请先 offerloop_read 读取目标岗位 JD 和我的简历版本，然后给我一份「这个岗位最可能问什么」的预测清单，并问我是否要直接改简历。')
                      onClose()
                    },
                  },
                  '用对话分析这个岗位',
                )
              : null,
            target
              ? h(
                  'button',
                  {
                    className: 'olp-btn quiet',
                    style: { marginLeft: 'auto' },
                    disabled: busy,
                    onClick: () => {
                      onClear()
                      onClose()
                    },
                  },
                  '清除目标',
                )
              : null,
          ),
        ),
      )
    }

    function TodoList(props) {
      const { todos, busy, run } = props
      const [text, setText] = useState('')
      async function add() {
        const value = text.trim()
        if (value === '') return
        await run('todo.add', { text: value })
        setText('')
      }
      return h(
        'div',
        { className: 'olp-card' },
        h('p', { className: 'olp-sec-title' }, '待办'),
        todos.length === 0 ? h('div', { className: 'olp-empty' }, '还没有待办。') : null,
        todos.map((todo) =>
          h(
            'div',
            { key: todo.id, className: 'olp-todo' + (todo.done ? ' done' : '') },
            h('input', { type: 'checkbox', checked: !!todo.done, onChange: () => run('todo.toggle', { id: todo.id }), disabled: busy }),
            h('span', null, todo.text),
            h('button', { className: 'olp-btn quiet', onClick: () => run('todo.delete', { id: todo.id }), disabled: busy }, '删'),
          ),
        ),
        h(
          'div',
          { className: 'olp-row', style: { marginTop: '10px' } },
          h('input', { className: 'olp-in', style: { flex: '1 1 160px' }, value: text, placeholder: '加一件要做的事…', onChange: (e) => setText(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') add() } }),
          h('button', { className: 'olp-btn', onClick: add, disabled: busy || text.trim() === '' }, '添加'),
        ),
      )
    }

    function TodayPage(props) {
      const { state, run, busy, openChat, go } = props
      const mocks = state.interviews.filter((item) => item.mode === 'mock')
      const real = state.interviews.filter((item) => item.mode !== 'mock')
      const stats = [
        { label: '简历版本', value: state.resumes.length },
        { label: '在投岗位', value: state.jobs.filter((job) => job.stage !== 'closed').length },
        { label: '模拟面试', value: mocks.length },
        { label: '真实面试', value: real.length },
      ]
      return h(
        'div',
        { className: 'olp-split' },
        h(
          'div',
          { className: 'olp-stats' },
          stats.map((stat) => h('div', { key: stat.label, className: 'olp-stat' }, h('b', null, String(stat.value)), h('span', null, stat.label))),
        ),
        h(
          'div',
          { className: 'olp-grid' },
          h(
            'div',
            { className: 'olp-card' },
            h('p', { className: 'olp-sec-title' }, '今天做哪件'),
            h(
              'div',
              { className: 'olp-row', style: { flexDirection: 'column', alignItems: 'stretch' } },
              h('button', { className: 'olp-btn', onClick: () => go('resume') }, '改简历（对话里直接说修改点）'),
              h('button', { className: 'olp-btn', onClick: () => go('mock') }, '来一场模拟面试'),
              h('button', { className: 'olp-btn', onClick: () => go('review') }, '复盘一次真实面试'),
            ),
            h('p', { className: 'olp-hint' }, state.target ? '当前目标：' + state.target.title + (state.target.company ? ' @ ' + state.target.company : '') : '还没有目标岗位。点上方「目标岗位」设置一下，模拟面试才有针对性的 JD。'),
          ),
          h(TodoList, { todos: state.todos, busy, run }),
          h(
            'div',
            { className: 'olp-card' },
            h('p', { className: 'olp-sec-title' }, '主线'),
            h('p', { className: 'olp-hint' }, '目标 JD → 简历版本 → 模拟面试（随机题 + 打分）→ 真实面试 → 复盘回写。'),
            h('p', { className: 'olp-hint' }, '数据目录就是右上角选的文件夹：目标岗位、简历版本、面试记录、复盘都写在其中的 .offerloop.json；换一个文件夹就是另一套数据。'),
            h('p', { className: 'olp-hint' }, '当前数据目录：' + (props.workspace ? props.workspace.title + ' · ' + props.workspace.path : '未选择')),
          ),
        ),
      )
    }

    function JobsPage(props) {
      const { state, run, busy, openChat } = props
      const [title, setTitle] = useState('')
      const [company, setCompany] = useState('')
      const [jd, setJd] = useState('')
      const [creating, setCreating] = useState(false)
      async function add() {
        if (title.trim() === '') return
        const ok = await run('job.add', { title: title.trim(), company: company.trim(), jd: jd.trim(), source: 'panel' })
        if (ok !== false) {
          setTitle('')
          setCompany('')
          setJd('')
          setCreating(false)
        }
      }
      return h(
        'div',
        null,
        creating
          ? h(
              'div',
              { className: 'olp-card', style: { marginBottom: '14px' } },
              h(
                'div',
                { className: 'olp-row', style: { justifyContent: 'space-between' } },
                h('p', { className: 'olp-sec-title', style: { margin: 0 } }, '新增岗位'),
                h('button', { className: 'olp-btn quiet', onClick: () => setCreating(false) }, '取消'),
              ),
              h(
                'div',
                { className: 'olp-form', style: { marginTop: '10px' } },
                h(Field, { label: '岗位标题' }, h('input', { className: 'olp-in', value: title, placeholder: '如：AI 产品经理', onChange: (e) => setTitle(e.target.value) })),
                h(Field, { label: '公司' }, h('input', { className: 'olp-in', value: company, placeholder: '公司名', onChange: (e) => setCompany(e.target.value) })),
                h(Field, { label: 'JD 摘要（可留空）', wide: true }, h('textarea', { className: 'olp-ta', value: jd, onChange: (e) => setJd(e.target.value) })),
                h(
                  'div',
                  { className: 'olp-row', style: { gridColumn: '1/-1' } },
                  h('button', { className: 'olp-btn pri', onClick: add, disabled: busy || title.trim() === '' }, '加入岗位库'),
                  h('button', { className: 'olp-btn', onClick: () => openChat('请分析一份 JD：我会粘贴文字或发截图。提取硬性要求、加分项、关键词和面试考点，最后把岗位用 offerloop_write 的 job.add 保存。') }, '用对话解析 JD'),
                ),
              ),
            )
          : h(
              'div',
              { className: 'olp-row', style: { marginBottom: '14px' } },
              h('button', { className: 'olp-btn', onClick: () => setCreating(true) }, '＋ 新增岗位'),
              h('span', { className: 'olp-hint' }, '投递看板：岗位 + 投递阶段；任意岗位都能「设为目标」。'),
            ),
        state.jobs.length === 0
          ? h('div', { className: 'olp-empty' }, '还没有岗位。先加一个，或把 JD 发给助手解析。')
          : h(
              'div',
              { className: 'olp-grid' },
              state.jobs.map((job) =>
                h(
                  'div',
                  { key: job.id, className: 'olp-item' },
                  h('div', { className: 'olp-item-top' }, h('h3', null, job.title + (job.company ? ' · ' + job.company : '')), h(Badge, null, job.id)),
                  job.jd ? h('p', null, job.jd.slice(0, 160)) : null,
                  h(
                    'div',
                    { className: 'olp-row' },
                    h(
                      'select',
                      { className: 'olp-sel', style: { width: 'auto' }, value: job.stage || 'lead', onChange: (e) => run('job.update', { id: job.id, patch: { stage: e.target.value } }), disabled: busy },
                      Object.entries(STAGES).map(([value, label]) => h('option', { key: value, value }, label)),
                    ),
                    h('button', { className: 'olp-btn quiet', onClick: () => run('target.set', { title: job.title, company: job.company || '', jd: job.jd || '', source: 'job' }), disabled: busy }, '设为目标'),
                    h('button', { className: 'olp-btn quiet', onClick: () => run('job.delete', { id: job.id }), disabled: busy }, '删除'),
                  ),
                ),
              ),
            ),
      )
    }

    function FilePicker(props) {
      const { workspace, version, initialDir, busy, onPick, onClose } = props
      const [dir, setDir] = useState(initialDir || '')
      const [entries, setEntries] = useState(null)
      const [error, setError] = useState('')
      const [selected, setSelected] = useState('')
      const [resumeOnly, setResumeOnly] = useState(true)
      const [query, setQuery] = useState('')
      const wsId = workspace ? workspace.id : ''
      const versionLabel = version ? version.id + '「' + version.title + '」' : '当前版本'
      const anchorRef = useRef(null)

      useEffect(() => {
        const node = anchorRef.current
        if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'start', inline: 'nearest' })
      }, [])

      const load = useCallback(
        async (nextDir) => {
          setError('')
          setEntries(null)
          setSelected('')
          setQuery('')
          try {
            const response = await fetch('/offerloop/api/files?ws=' + encodeURIComponent(wsId) + '&dir=' + encodeURIComponent(nextDir || ''), { headers: { accept: 'application/json' } })
            const data = await response.json().catch(() => ({}))
            if (!response.ok || data.ok === false) throw new Error(data.error || 'HTTP ' + response.status)
            setDir(data.dir || '')
            setEntries(data.entries || [])
          } catch (err) {
            setError(String((err && err.message) || err))
            setEntries([])
          }
        },
        [wsId],
      )

      useEffect(() => {
        load(initialDir || '')
      }, [])

      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [])

      const crumbs = splitPath(dir)
      const childPath = (name) => (dir ? dir + '/' + name : name)
      const queryText = query.trim().toLowerCase()
      const visible = (entries || []).filter((entry) => {
        if (entry.kind === 'file' && resumeOnly && !entry.resume) return false
        return queryText === '' || entry.name.toLowerCase().includes(queryText)
      })
      const folderCount = visible.filter((entry) => entry.kind === 'dir').length
      const fileCount = visible.length - folderCount
      const choose = (path) => {
        if (busy || path === '') return
        onPick(path)
      }

      return h(
        'div',
        { className: 'olp-card olp-pickpage', ref: anchorRef },
        h(
          'div',
          { className: 'olp-pick-head' },
          h(
            'div',
            null,
            h('h2', { className: 'olp-pick-title' }, '选择简历文件'),
            h('p', { className: 'olp-hint' }, '给版本 ' + versionLabel + ' 指定一份简历；保存后助手会先读这份文件，再按你的修改点改。'),
          ),
          h('button', { className: 'olp-btn', onClick: onClose }, '取消'),
        ),
        h(
          'div',
          { className: 'olp-pick-toolbar' },
          h(
            'div',
            { className: 'olp-pick-crumbs' },
            h('button', { className: 'olp-pick-crumb' + (crumbs.length === 0 ? ' last' : ''), title: workspace ? workspace.path : '', onClick: () => load('') }, '数据目录'),
            crumbs.map((segment, index) =>
              h(
                'span',
                { key: 'crumb-' + index, className: 'olp-pick-crumb-wrap' },
                h('span', { className: 'olp-pick-sep' }, '›'),
                h('button', { className: 'olp-pick-crumb' + (index === crumbs.length - 1 ? ' last' : ''), onClick: () => load(crumbs.slice(0, index + 1).join('/')) }, segment),
              ),
            ),
          ),
          h('input', { className: 'olp-pick-search', placeholder: '搜索当前文件夹…', value: query, onChange: (e) => setQuery(e.target.value) }),
        ),
        h(
          'div',
          { className: 'olp-pick-meta' },
          h('label', { className: 'olp-check' }, h('input', { type: 'checkbox', checked: resumeOnly, onChange: (e) => setResumeOnly(e.target.checked) }), '只看简历类文件'),
          h('span', { className: 'olp-hint' }, folderCount + ' 个文件夹 · ' + fileCount + ' 个文件'),
        ),
        error ? h('div', { className: 'olp-error', style: { padding: '8px 12px', fontSize: '12.5px' } }, error) : null,
        h(
          'div',
          { className: 'olp-pick-list' },
          entries === null ? h('div', { className: 'olp-pick-empty' }, '读取中…') : null,
          entries !== null && visible.length === 0
            ? h('div', { className: 'olp-pick-empty' }, queryText !== '' ? '没有匹配「' + query + '」的文件。' : resumeOnly ? '这个文件夹里没有简历类文件；可以取消「只看简历类文件」再找。' : '这个文件夹是空的。')
            : null,
          visible.map((entry) => {
            const path = childPath(entry.name)
            const isDir = entry.kind === 'dir'
            const ext = !isDir && entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.') + 1).toUpperCase() : ''
            return h(
              'button',
              {
                key: entry.kind + ':' + entry.name,
                type: 'button',
                title: entry.name,
                className: 'olp-pick-row' + (selected === path ? ' on' : ''),
                onClick: () => (isDir ? load(path) : setSelected(path)),
                onDoubleClick: () => (isDir ? load(path) : choose(path)),
              },
              h('span', { className: 'olp-pick-ico' }, isDir ? '📁' : '📄'),
              h('span', { className: 'olp-pick-name' }, entry.name),
              ext !== '' ? h('span', { className: 'olp-pick-tag' }, ext) : null,
              selected === path ? h('span', { className: 'olp-pick-tag on' }, '已选') : null,
            )
          }),
        ),
        h(
          'div',
          { className: 'olp-pick-foot' },
          h('div', { className: 'olp-pick-sel' + (selected === '' ? '' : ' set'), title: selected }, selected === '' ? '点文件名选中，双击直接确定' : '已选：' + selected),
          h('button', { className: 'olp-btn', onClick: onClose }, '取消'),
          h('button', { className: 'olp-btn pri', disabled: busy || selected === '', onClick: () => choose(selected) }, '用这份简历'),
        ),
      )
    }

    function ResumePage(props) {
      const { state, run, busy, openChat, workspace } = props
      const [title, setTitle] = useState('')
      const [parentId, setParentId] = useState('')
      const [targetJobId, setTargetJobId] = useState('')
      const [picking, setPicking] = useState('')
      const [creating, setCreating] = useState(false)
      async function add() {
        if (title.trim() === '') return
        const ok = await run('resume.add', { title: title.trim(), parentId, targetJobId })
        if (ok !== false) {
          setTitle('')
          setCreating(false)
        }
      }
      const jobTitle = (id) => {
        const job = state.jobs.find((item) => item.id === id)
        return job ? job.title : ''
      }
      const versionById = new Map(state.resumes.map((version) => [version.id, version]))
      const diffCounts = (version) => {
        const parent = version.parentId ? versionById.get(version.parentId) : null
        if (!parent) return null
        const flat = (item) => (item.sections || []).reduce((acc, section) => acc.concat((section.bullets || []).map((bullet) => String(bullet.text || '').trim()).filter(Boolean)), [])
        const before = flat(parent)
        const after = flat(version)
        const beforeSet = new Set(before)
        const afterSet = new Set(after)
        return {
          added: after.filter((text) => !beforeSet.has(text)).length,
          removed: before.filter((text) => !afterSet.has(text)).length,
        }
      }
      const updatePrompt = (version) =>
        '请更新简历版本 ' +
        version.id +
        '（' +
        version.title +
        '）' +
        (version.file ? '，简历文件是「' + version.file + '」（相对数据目录）' : '') +
        '。先 offerloop_read 读取目标岗位与该版本现状' +
        (version.file ? '，并读这份简历文件' : '') +
        '；然后等我说修改点，按我说的改，不要自己补造经历或数字。写完用 offerloop_write，action=resume.update，payload={"id":"' +
        version.id +
        '","sections":[{"heading":"…","bullets":[{"text":"…"}]}],"diffSummary":["…"]} 保存。'
      const filePrompt = (version) =>
        '我的简历文件是「' +
        version.file +
        '」（相对数据目录）。请先读这份文件，结合目标岗位 JD 和版本「' +
        version.title +
        '」给我修改点建议；不要自己补造经历或数字，等我确认后再改。'

      const pickingVersion = picking ? state.resumes.find((version) => version.id === picking) : null
      if (pickingVersion) {
        return h(FilePicker, {
          workspace,
          version: pickingVersion,
          initialDir: dirNameOf(pickingVersion.file),
          busy,
          onClose: () => setPicking(''),
          onPick: async (file) => {
            const ok = await run('resume.update', { id: pickingVersion.id, file })
            if (ok !== false) setPicking('')
          },
        })
      }

      return h(
        'div',
        null,
        creating
          ? h(
              'div',
              { className: 'olp-card', style: { marginBottom: '14px' } },
              h(
                'div',
                { className: 'olp-row', style: { justifyContent: 'space-between' } },
                h('p', { className: 'olp-sec-title', style: { margin: 0 } }, '新建简历版本'),
                h('button', { className: 'olp-btn quiet', onClick: () => setCreating(false) }, '取消'),
              ),
              h(
                'div',
                { className: 'olp-form', style: { marginTop: '10px', marginBottom: '10px' } },
                h(Field, { label: '版本标题' }, h('input', { className: 'olp-in', value: title, placeholder: '如：某 AI 产品经理 定制版', onChange: (e) => setTitle(e.target.value) })),
                h(
                  Field,
                  { label: '父版本' },
                  h(
                    'select',
                    { className: 'olp-sel', value: parentId, onChange: (e) => setParentId(e.target.value) },
                    h('option', { value: '' }, '无（新基线）'),
                    state.resumes.map((version) => h('option', { key: version.id, value: version.id }, version.title + ' · ' + version.id)),
                  ),
                ),
                h(
                  Field,
                  { label: '目标岗位' },
                  h(
                    'select',
                    { className: 'olp-sel', value: targetJobId, onChange: (e) => setTargetJobId(e.target.value) },
                    h('option', { value: '' }, '未绑定'),
                    state.jobs.map((job) => h('option', { key: job.id, value: job.id }, job.title + (job.company ? ' @ ' + job.company : ''))),
                  ),
                ),
                h(
                  'div',
                  { className: 'olp-row', style: { gridColumn: '1/-1' } },
                  h('button', { className: 'olp-btn pri', onClick: add, disabled: busy || title.trim() === '' }, '创建版本'),
                  h('button', { className: 'olp-btn', onClick: () => openChat('我要改简历。请先 offerloop_read 读取目标岗位和当前简历版本，然后等我说修改点；不要自己补造经历或数字。') }, '用对话改简历'),
                ),
              ),
              h('p', { className: 'olp-hint' }, '创建后可在版本卡片里指定简历文件；指定后助手会先读那份文件再改。'),
            )
          : h(
              'div',
              { className: 'olp-row', style: { marginBottom: '14px' } },
              h('button', { className: 'olp-btn', onClick: () => setCreating(true) }, '＋ 新建简历版本'),
              h('span', { className: 'olp-hint' }, state.resumes.length === 0 ? '还没有版本；先建一个基线，再指定简历文件。' : '按目标岗位分叉；每个版本各指一份简历文件。'),
            ),
        state.resumes.length === 0
          ? h('div', { className: 'olp-empty' }, '还没有简历版本。')
          : h(
              'div',
              { className: 'olp-grid' },
              state.resumes.map((version) => {
                const diff = diffCounts(version)
                return h(
                  'div',
                  { key: version.id, className: 'olp-item' },
                  h('div', { className: 'olp-item-top' }, h('h3', null, version.title), h(Badge, null, version.id)),
                  h(
                    'div',
                    { className: 'olp-meta' },
                    h('span', null, '父版本：' + (version.parentId || '无')),
                    version.targetJobId ? h('span', null, '目标：' + (jobTitle(version.targetJobId) || version.targetJobId)) : null,
                    h('span', null, (version.sections || []).length + ' 个段落'),
                    diff ? h('span', null, '相对父版本：+' + diff.added + ' / −' + diff.removed) : null,
                  ),
                  h(
                    'div',
                    { className: 'olp-file' },
                    h('span', null, '简历文件：'),
                    version.file ? h('b', { className: 'olp-file-name', title: version.file }, baseNameOf(version.file)) : h('span', null, '未指定'),
                    version.file && dirNameOf(version.file) !== '' ? h('span', { className: 'olp-hint' }, '· ' + dirNameOf(version.file) + '/') : null,
                    h('button', { className: 'olp-btn', onClick: () => setPicking(version.id) }, version.file ? '更换' : '选择文件'),
                    version.file ? h('button', { className: 'olp-btn quiet', onClick: () => run('resume.update', { id: version.id, file: '' }), disabled: busy }, '清除') : null,
                    version.file
                      ? h('button', { className: 'olp-btn quiet', style: { marginLeft: 'auto' }, onClick: () => openChat(filePrompt(version)) }, '让助手读这份文件')
                      : null,
                  ),
                  version.file ? null : h('p', { className: 'olp-hint' }, '点「选择文件」会在面板里打开数据目录的文件列表；有多份简历时先指定用哪一份，不指定时助手只维护结构化简历。'),
                  (version.diffSummary || []).length > 0 ? h('p', null, (version.diffSummary || []).join('\n')) : null,
                  (version.sections || []).length === 0
                    ? h('p', { className: 'olp-hint' }, '还没有段落。点「用对话更新」，把修改点直接说给助手。')
                    : h(
                        'div',
                        { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                        (version.sections || []).map((section, sectionIndex) =>
                          h(
                            'div',
                            { key: 's-' + sectionIndex },
                            section.heading ? h('div', { style: { fontSize: '12.5px', fontWeight: 600 } }, section.heading) : null,
                            (section.bullets || []).map((bullet, bulletIndex) =>
                              h(
                                'div',
                                { key: 'b-' + bulletIndex, style: { fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary)', marginTop: '3px', wordBreak: 'break-word' } },
                                '· ' + bullet.text,
                              ),
                            ),
                          ),
                        ),
                      ),
                  h(
                    'div',
                    { className: 'olp-meta' },
                    h('button', { className: 'olp-btn quiet', style: { marginLeft: 'auto' }, onClick: () => openChat(updatePrompt(version)) }, '用对话更新'),
                    h('button', { className: 'olp-btn quiet', onClick: () => run('resume.delete', { id: version.id }), disabled: busy }, '删除'),
                  ),
                )
              }),
            ),
      )
    }

    function mockPrompt(roundType, target, version) {
      const lines = [
        '请开始一场「' + roundType + '」模拟面试。',
        target
          ? '目标岗位：' + target.title + (target.company ? ' @ ' + target.company : '') + '。'
          : '目标岗位：先用 offerloop_read 读 target；如果为空，问我岗位再继续。',
        target && target.jd ? 'JD 要点：' + String(target.jd).slice(0, 1200) : '',
        version ? '简历版本：' + version.id + '（' + version.title + '）。' : '',
        version && version.file ? '简历文件：' + version.file + '（相对数据目录）；出题前先读这份文件。' : '',
        '步骤：1) 先 offerloop_read 读取目标岗位与该简历版本；2) 随机生成 5 个问题（业务 2、专业 2、动机/HR 1，顺序打乱，避开最近一次模拟的题）；3) 一次只问一个，我回答后追问 1 层；4) 每题记录：问题、我的回答、档位 A/B/C/D、维度（需求判断/优先级/指标口径/推进/复盘/表达）、一句点评；5) 全部结束后给总体：一句话结论、3 条优势、3 个待补；6) 用 offerloop_write，action=interview.add，mode=mock，round="' + roundType + '"，把 questions 与 overall 一并保存。',
      ]
      return lines.filter(Boolean).join('\n')
    }

    function MockPage(props) {
      const { state, run, busy, openChat } = props
      const target = state.target
      const versions = state.resumes || []
      const [resumeId, setResumeId] = useState(versions[0] ? versions[0].id : '')
      const [roundType, setRoundType] = useState('业务面')
      const current = versions.find((version) => version.id === resumeId) || versions[0] || null
      const mocks = state.interviews.filter((item) => item.mode === 'mock')

      return h(
        'div',
        { className: 'olp-split' },
        h(
          'div',
          { className: 'olp-card' },
          h('p', { className: 'olp-sec-title' }, '生成一场模拟面试'),
          h(
            'div',
            { className: 'olp-ctx' },
            h('span', null, '目标岗位：' + (target ? target.title + (target.company ? ' @ ' + target.company : '') : '未设置')),
            h('span', null, '简历：' + (current ? current.title + ' · ' + current.id : '无') + (current && current.file ? ' · 文件 ' + baseNameOf(current.file) : '')),
          ),
          h(
            'div',
            { className: 'olp-form' },
            h(
              Field,
              { label: '面试类型' },
              h('select', { className: 'olp-sel', value: roundType, onChange: (e) => setRoundType(e.target.value) }, ['业务面', '专业面', 'HR 面', '压力面'].map((item) => h('option', { key: item, value: item }, item))),
            ),
            h(
              Field,
              { label: '简历版本' },
              h(
                'select',
                { className: 'olp-sel', value: resumeId, onChange: (e) => setResumeId(e.target.value) },
                versions.length === 0 ? h('option', { value: '' }, '无版本') : versions.map((version) => h('option', { key: version.id, value: version.id }, version.title + ' · ' + version.id)),
              ),
            ),
            h(
              'div',
              { className: 'olp-row', style: { gridColumn: '1/-1' } },
              h('button', { className: 'olp-btn pri', onClick: () => openChat(mockPrompt(roundType, target, current)) }, '随机出题并开始'),
              h('button', { className: 'olp-btn', onClick: () => openChat(mockPrompt('压力面', target, current)) }, '压力面（追问更狠）'),
            ),
            h(
              'p',
              { className: 'olp-hint', style: { gridColumn: '1/-1' } },
              '题目由助手基于 JD 与简历随机生成；一次一问、逐题追问，结束后按档位打分并把结果写回这里。',
            ),
          ),
        ),
        mocks.length === 0
          ? h('div', { className: 'olp-empty' }, '还没有模拟面试。先来一场——随机题比你自己想题更容易暴露盲区。')
          : h(
              'div',
              { className: 'olp-grid' },
              mocks.map((interview) =>
                h(
                  'div',
                  { key: interview.id, className: 'olp-item' },
                  h(
                    'div',
                    { className: 'olp-item-top' },
                    h('h3', null, (interview.jobTitle || '模拟面试') + ' · ' + interview.round),
                    interview.overall && interview.overall.score ? h(Badge, { kind: SCORE_KIND[interview.overall.score] || '' }, '总体 ' + interview.overall.score) : h(Badge, null, '未评分'),
                  ),
                  h('div', { className: 'olp-meta' }, h('span', null, interview.type || '业务面'), h('span', null, new Date(interview.createdAt).toLocaleDateString('zh-CN')), h('span', null, (interview.questions || []).length + ' 题'), h('span', null, interview.id)),
                  interview.overall && interview.overall.summary ? h('p', null, '结论：' + interview.overall.summary) : null,
                  interview.overall && (interview.overall.strengths || []).length > 0 ? h('p', null, '优势：' + interview.overall.strengths.join('；')) : null,
                  interview.overall && (interview.overall.gaps || []).length > 0 ? h('p', null, '待补：' + interview.overall.gaps.join('；')) : null,
                  (interview.questions || []).map((question, index) =>
                    h(
                      'div',
                      { key: 'q-' + index, className: 'olp-q' },
                      h('b', null, 'Q' + (index + 1) + '. ' + question.q),
                      question.a ? h('div', { className: 'a' }, '我的回答：' + question.a) : null,
                      h(
                        'div',
                        { className: 'olp-meta' },
                        question.score ? h(Badge, { kind: SCORE_KIND[question.score] || '' }, question.score) : null,
                        question.dimension ? h(Badge, null, question.dimension) : null,
                        question.comment ? h('span', null, question.comment) : null,
                      ),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'olp-meta' },
                    h('button', { className: 'olp-btn quiet', style: { marginLeft: 'auto' }, onClick: () => openChat('继续追问上一场模拟面试里得分最低的问题。先 offerloop_read 读取面试记录 ' + interview.id + '，然后针对薄弱项再问 3 个更深的问题，并更新该记录（interview.update）。') }, '继续追问'),
                    h('button', { className: 'olp-btn quiet', onClick: () => run('interview.delete', { id: interview.id }), disabled: busy }, '删除'),
                  ),
                ),
              ),
            ),
      )
    }

    function ReviewPage(props) {
      const { state, run, busy, openChat } = props
      const [jobId, setJobId] = useState('')
      const [round, setRound] = useState('一面')
      const [type, setType] = useState('业务面')
      const [notes, setNotes] = useState('')
      const [retroInterviewId, setRetroInterviewId] = useState('')
      const [worked, setWorked] = useState('')
      const [broke, setBroke] = useState('')
      const [gaps, setGaps] = useState('')
      const [actions, setActions] = useState('')

      async function addInterview() {
        await run('interview.add', { jobId, round, type, mode: 'real', notes: notes.trim() })
        setNotes('')
      }
      async function addRetro() {
        await run('retro.add', {
          interviewId: retroInterviewId,
          worked: worked.trim(),
          broke: broke.trim(),
          gaps: gaps.split('\n').map((line) => line.trim()).filter(Boolean),
          actions: actions.split('\n').map((line) => line.trim()).filter(Boolean),
        })
        setWorked('')
        setBroke('')
        setGaps('')
        setActions('')
      }
      const real = state.interviews.filter((item) => item.mode !== 'mock')
      const jobOf = (id) => state.jobs.find((job) => job.id === id)

      return h(
        'div',
        { className: 'olp-split' },
        h(
          'div',
          { className: 'olp-card' },
          h('p', { className: 'olp-sec-title' }, '记录一次真实面试'),
          h(
            'div',
            { className: 'olp-form' },
            h(
              Field,
              { label: '关联岗位' },
              h(
                'select',
                { className: 'olp-sel', value: jobId, onChange: (e) => setJobId(e.target.value) },
                h('option', { value: '' }, '不关联'),
                state.jobs.map((job) => h('option', { key: job.id, value: job.id }, job.title + (job.company ? ' @ ' + job.company : ''))),
              ),
            ),
            h(Field, { label: '轮次' }, h('select', { className: 'olp-sel', value: round, onChange: (e) => setRound(e.target.value) }, ROUNDS.map((item) => h('option', { key: item, value: item }, item)))),
            h(Field, { label: '类型' }, h('input', { className: 'olp-in', value: type, onChange: (e) => setType(e.target.value) })),
            h(Field, { label: '速记：问题与我的回答', wide: true }, h('textarea', { className: 'olp-ta', value: notes, placeholder: 'Q: …\nA: …', onChange: (e) => setNotes(e.target.value) })),
            h(
              'div',
              { className: 'olp-row', style: { gridColumn: '1/-1' } },
              h('button', { className: 'olp-btn pri', onClick: addInterview, disabled: busy }, '保存面试记录'),
              h('button', { className: 'olp-btn', onClick: () => openChat('我要复盘一次真实面试。请让我先口述问题与我的回答，然后按「当时怎么答 / 考点是什么 / 下次怎么答」整理，并把待补的事实写成待办（offerloop_write 的 retro.add 与 todo.add）。') }, '用对话复盘'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'olp-card' },
          h('p', { className: 'olp-sec-title' }, '三段式复盘'),
          h(
            'div',
            { className: 'olp-form' },
            h(
              Field,
              { label: '关联面试' },
              h(
                'select',
                { className: 'olp-sel', value: retroInterviewId, onChange: (e) => setRetroInterviewId(e.target.value) },
                h('option', { value: '' }, '不关联'),
                real.map((interview) => h('option', { key: interview.id, value: interview.id }, (interview.jobTitle || '面试') + ' · ' + interview.round + ' · ' + interview.id)),
              ),
            ),
            h(Field, { label: '当时答得好的' }, h('textarea', { className: 'olp-ta', value: worked, onChange: (e) => setWorked(e.target.value) })),
            h(Field, { label: '被追问破防的' }, h('textarea', { className: 'olp-ta', value: broke, onChange: (e) => setBroke(e.target.value) })),
            h(Field, { label: '下次要补的事实 / 例子（一行一条）', wide: true }, h('textarea', { className: 'olp-ta', value: gaps, onChange: (e) => setGaps(e.target.value) })),
            h(Field, { label: '下次怎么答（一行一条）', wide: true }, h('textarea', { className: 'olp-ta', value: actions, onChange: (e) => setActions(e.target.value) })),
            h(
              'div',
              { className: 'olp-row', style: { gridColumn: '1/-1' } },
              h('button', { className: 'olp-btn pri', onClick: addRetro, disabled: busy }, '保存复盘'),
            ),
          ),
        ),
        real.length === 0 && state.retros.length === 0
          ? h('div', { className: 'olp-empty' }, '还没有真实面试记录。面完当天记一条，比事后回忆有用得多。')
          : h(
              'div',
              { className: 'olp-grid' },
              real.map((interview) => {
                const job = jobOf(interview.jobId)
                return h(
                  'div',
                  { key: interview.id, className: 'olp-item' },
                  h('div', { className: 'olp-item-top' }, h('h3', null, (job ? job.title : interview.jobTitle || '面试') + ' · ' + interview.round), h(Badge, null, interview.id)),
                  h('div', { className: 'olp-meta' }, h('span', null, interview.type), h('span', null, new Date(interview.createdAt).toLocaleDateString('zh-CN'))),
                  interview.notes ? h('p', null, interview.notes.slice(0, 260)) : null,
                  h('div', { className: 'olp-meta' }, h('button', { className: 'olp-btn quiet', style: { marginLeft: 'auto' }, onClick: () => run('interview.delete', { id: interview.id }), disabled: busy }, '删除')),
                )
              }),
              state.retros.map((retro) =>
                h(
                  'div',
                  { key: retro.id, className: 'olp-item' },
                  h('div', { className: 'olp-item-top' }, h('h3', null, '复盘 ' + retro.id), h(Badge, null, retro.interviewId || '未关联')),
                  retro.broke ? h('p', null, '破防点：' + retro.broke) : null,
                  (retro.gaps || []).length > 0 ? h('p', null, '待补：' + retro.gaps.join('；')) : null,
                  (retro.actions || []).length > 0 ? h('p', null, '下次：' + retro.actions.join('；')) : null,
                  h('div', { className: 'olp-meta' }, h('button', { className: 'olp-btn quiet', style: { marginLeft: 'auto' }, onClick: () => run('retro.delete', { id: retro.id }), disabled: busy }, '删除')),
                ),
              ),
            ),
      )
    }

    function Panel(props) {
      const ctx = props.ctx || {}
      const [boot, setBoot] = useState({ loading: true, error: '', workspaces: [], ws: '', workspace: null, state: null })
      const [tab, setTab] = useState('today')
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState(null)
      const [targetOpen, setTargetOpen] = useState(false)

      const refresh = useCallback(async function refresh(wsId) {
        try {
          const data = await callBootstrap(wsId)
          setBoot({ loading: false, error: '', workspaces: data.workspaces || [], ws: data.ws || '', workspace: data.workspace || null, state: data.state || null })
          if (data.ws) {
            try {
              localStorage.setItem('offerloop.ws', data.ws)
            } catch {
              /* ignore */
            }
          }
        } catch (error) {
          setBoot((prev) => ({ ...prev, loading: false, error: String((error && error.message) || error) }))
        }
      }, [])

      useEffect(() => {
        let initial = ''
        try {
          initial = localStorage.getItem('offerloop.ws') || ''
        } catch {
          /* ignore */
        }
        refresh(initial || undefined)
      }, [refresh])

      async function run(action, payload) {
        setBusy(true)
        setNotice(null)
        try {
          const response = await fetch('/offerloop/api/action', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ws: boot.ws, action, payload }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok || data.ok === false) throw new Error(data.error || 'HTTP ' + response.status)
          setBoot((prev) => ({ ...prev, workspaces: data.workspaces || prev.workspaces, ws: data.ws || prev.ws, workspace: data.workspace || prev.workspace, state: data.state || prev.state }))
          return true
        } catch (error) {
          setNotice({ kind: 'err', text: '保存失败：' + String((error && error.message) || error) })
          return false
        } finally {
          setBusy(false)
        }
      }

      async function listAgentIds() {
        try {
          const response = await fetch('/offerloop/api/agents', { headers: { accept: 'application/json' } })
          const data = await response.json().catch(() => ({}))
          return Array.isArray(data.ids) ? data.ids : []
        } catch (error) {
          return []
        }
      }

      function claimSession(sessionId) {
        return fetch('/offerloop/api/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ ws: boot.ws || '', sessionId }),
        }).catch(() => undefined)
      }

      // The Host only gives the job-search persona to sessions claimed here, so
      // every session started from the panel is the one that owns it.
      async function claimNewSession(before) {
        const known = new Set(before)
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const ids = await listAgentIds()
          const fresh = ids.filter((id) => !known.has(id))
          if (fresh.length > 0) {
            await claimSession(fresh[fresh.length - 1])
            return
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      async function openChat(prompt) {
        try {
          if (ctx.uiWorkspace && typeof ctx.uiWorkspace.startSession === 'function') {
            const before = await listAgentIds()
            ctx.uiWorkspace.startSession(boot.ws || undefined, { prompt, whenDraftExists: 'replace' })
            if (ctx.layout && typeof ctx.layout.selectPanel === 'function') ctx.layout.selectPanel(null)
            setNotice({ kind: 'ok', text: '已打开新会话并预填了提示词，按回车发送。' })
            claimNewSession(before)
          } else {
            setNotice({ kind: 'err', text: '当前版本不支持从面板打开会话，请在侧边栏新建会话。' })
          }
        } catch (error) {
          setNotice({ kind: 'err', text: '打开会话失败：' + String((error && error.message) || error) })
        }
      }

      if (boot.loading) return h('div', { className: 'olp-wrap' }, h('div', { className: 'olp-loading' }, '正在读取求职台…'))
      if (boot.error) {
        return h(
          'div',
          { className: 'olp-wrap' },
          h(
            'div',
            { className: 'olp-error' },
            h('b', null, '读不到求职台数据'),
            h('span', null, boot.error),
            h('span', { className: 'olp-hint' }, '如果是刚安装插件，请刷新页面；如果持续失败，确认数据目录（workspace）还在，并在顶栏切一下目录。'),
            h('button', { className: 'olp-btn', onClick: () => { setBoot((prev) => ({ ...prev, loading: true })); refresh(boot.ws || undefined) } }, '重试'),
          ),
        )
      }
      if (!boot.state) {
        return h('div', { className: 'olp-wrap' }, h('div', { className: 'olp-empty' }, '还没有可用的数据目录。先在侧边栏打开一个文件夹作为工作区，再回到求职台；求职数据会写进那个文件夹的 .offerloop.json。'))
      }

      const state = boot.state
      const tabs = [
        { id: 'today', label: '今日' },
        { id: 'jobs', label: '岗位' },
        { id: 'resume', label: '简历' },
        { id: 'mock', label: '面试模拟' },
        { id: 'review', label: '复盘' },
      ]
      const go = (nextTab) => setTab(nextTab)

      return h(
        'div',
        { className: 'olp-wrap' },
        h('style', null, CSS),
        h(
          'header',
          { className: 'olp-head' },
          h('div', { className: 'olp-title' }, h(Icon, { size: 26 }), h('div', null, h('h1', null, '求职台'), h('p', null, '目标 JD → 简历 → 模拟面试 → 复盘'))),
          h(
            'div',
            { className: 'olp-head-actions' },
            h(
              'label',
              { className: 'olp-dirlabel', htmlFor: 'olp-dir-select', title: '求职数据（.offerloop.json）保存在这个文件夹；换一个就是换一套数据。' },
              h('span', null, '数据目录'),
              h(
                'select',
                {
                  id: 'olp-dir-select',
                  className: 'olp-sel',
                  style: { width: 'auto', maxWidth: '240px' },
                  value: boot.ws,
                  onChange: (e) => {
                    const next = e.target.value
                    setBoot((prev) => ({ ...prev, ws: next }))
                    refresh(next)
                  },
                  'aria-label': '数据目录（求职数据存放的文件夹）',
                },
                boot.workspaces.map((workspace) => h('option', { key: workspace.id, value: workspace.id, title: workspace.path }, workspace.title)),
              ),
            ),
            h('button', { className: 'olp-btn quiet', onClick: () => refresh(boot.ws) }, '刷新'),
          ),
        ),
        h(
          'div',
          { className: 'olp-tabrow' },
          h(
            'div',
            { className: 'olp-tabs' },
            tabs.map((item) => h('button', { key: item.id, className: 'olp-tab' + (tab === item.id ? ' on' : ''), onClick: () => setTab(item.id) }, item.label)),
          ),
          h(TargetChip, { target: state.target, open: targetOpen, onToggle: () => setTargetOpen((prev) => !prev) }),
        ),
        targetOpen
          ? h(TargetEditor, {
              target: state.target,
              busy,
              onSave: (payload) => run('target.set', payload),
              onClear: () => run('target.clear', {}),
              onOpenChat: openChat,
              onClose: () => setTargetOpen(false),
            })
          : null,
        notice ? h('div', { className: 'olp-notice ' + (notice.kind === 'err' ? 'err' : 'ok') }, notice.text) : null,
        tab === 'today' ? h(TodayPage, { state, run, busy, openChat, workspace: boot.workspace, go }) : null,
        tab === 'jobs' ? h(JobsPage, { state, run, busy, openChat }) : null,
        tab === 'resume' ? h(ResumePage, { state, run, busy, openChat, workspace: boot.workspace }) : null,
        tab === 'mock' ? h(MockPage, { state, run, busy, openChat }) : null,
        tab === 'review' ? h(ReviewPage, { state, run, busy, openChat }) : null,
        h('p', { className: 'olp-hint', style: { marginTop: '18px' } }, '数据文件：' + (boot.workspace ? boot.workspace.path : '') + '\\.offerloop.json · 修订 ' + String(state.rev || 0)),
      )
    }

    return {
      inject: ['slots', 'layout', 'uiWorkspace'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: 'offerloop', order: 20, label: '求职台' }, PanelIcon),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'offerloop' }, () => h(Boundary, null, h(Panel, { ctx }))),
        )
      },
    }
  },
})