# 求职台 OfferLoop（DSH 插件）

一条求职主线：**目标 JD → 简历版本 → 模拟面试（随机题 + 打分）→ 真实面试 → 复盘**。
装进 DeepSeek Harness 后，左侧栏出现「求」图标，点开是整页工作台；数据存在当前 workspace 的 `.offerloop.json`。

「数据目录」就是当前 workspace：顶栏可以切换，换一个文件夹就是换一套求职数据。
简历版本可以像选文件一样**指定简历文件**（数据目录内的相对路径），指定后助手会先读那份文件再改；不指定时只维护面板里的结构化简历。

不维护证据库；不自动导入当前文件夹里的旧简历文档——只有你显式指定了文件，助手才读那一份。

## 在其他 DSH 里安装

这个仓库本身就是可安装的 bundle（`package.json` 声明了 `dsh.bundle.patch`，Host 与 Client 各一半都在仓库内），不需要 npm 发布，也没有构建步骤（纯 JS、零运行时依赖）。

1. 克隆到任意目录：`git clone <repo-url> dsh-offerloop`
2. 在目标 DSH 的会话里调用 `plugin_manager`：`action: install_bundle`，`target` 填该目录的绝对路径。
3. 刷新 Harness 页面，左侧栏出现「求」；设置 → 插件 里显示名为 `dsh-offerloop`，行 id 为 `offerloop`。

卸载：`plugin_manager` 的 `remove_bundle`，target 填 `dsh-offerloop`。

> 数据不随插件走：求职数据保存在会话 workspace 的 `.offerloop.json`，仓库里不含任何个人数据，可安全公开。

## 打开与使用

1. 刷新 Harness 页面（首次安装后浏览器要重新加载 Client 模块）。
2. 左侧栏点「求」→ 求职台。
3. 页签右上角「目标岗位」先设一个（文字或 JD 截图），后面的模拟面试才有针对性。

### 数据目录（顶栏）

- 顶栏「数据目录」下拉 = 当前 workspace；求职台的数据（目标岗位、简历版本、面试记录、复盘、待办）全部写在**这个文件夹**的 `.offerloop.json` 里。
- 在侧边栏打开另一个文件夹并在顶栏切过去，就是另一套数据；悬停下拉可看说明，「今日」页也有一行解释。
- 助手默认读写**你当前会话所在的目录**（也就是面板里的数据目录），不会写到别的文件夹；需要显式指定时用工具的 `workspace` 参数。
- 没有指定目录时面板会提示先在侧边栏打开一个工作区。

### 目标岗位（变量）

目标岗位不再占一整块常驻表单：页签右上角有一个目标岗位胶囊，显示当前目标（未设置时是虚线的「未设置」）。

- **文字**：点胶囊 → 展开编辑卡片 → 填标题/公司/JD → 保存；再点胶囊或「收起」关闭。
- **截图**：编辑卡片里点「用截图设置」→ 新开会话并预填提示词；把 JD 截图粘进对话，助手读图后用 `offerloop_write` 的 `target.set` 保存。
- 岗位库里的任意岗位都可以「设为目标」。
- 已有目标时可以「用对话分析这个岗位」（预测会被问什么）或「清除目标」。

### 简历文件（每个版本各指一份）

页签「简历」里，每个版本卡片都有一行「简历文件」：

- **选择文件**：打开整页的文件选择视图（不是缩在卡片里的小框）——顶部是数据目录 › 子文件夹的面包屑，右边可以搜当前文件夹，默认只列 docx / doc / pdf / md / txt 等简历类文件（可取消过滤看全部）。
- 单击文件名选中（右侧出现「已选」），双击直接确定；也可以选中后点底部「用这份简历」。Esc 或「取消」返回简历列表。
- 选中后路径写进该版本的 `file` 字段（相对数据目录、用 `/` 分隔）；卡片上显示文件名（悬停看完整路径），可以「更换」或「清除」。
- **让助手读这份文件**：新开会话并预填提示词，助手先读这份文件、结合目标 JD 给修改点建议，等你确认后再改。
- 同时有多份简历文件时，每个版本各指一份；「面试模拟」里选版本就等于选文件，出题前助手会先读它。
- 文件必须位于数据目录内且真实存在，否则保存时报错（`找不到简历文件` / `简历文件必须位于当前数据目录内`）。
- 不指定时，助手只维护面板里的结构化段落，不会自己去翻其他简历文档。

### 五个页签

| 页签 | 内容 |
|---|---|
| 今日 | 简历/在投/模拟/真实面试计数、待办、快捷入口 |
| 岗位 | 岗位库、投递阶段流转、设为目标 |
| 简历 | 版本树（父版本、目标岗位）、**指定简历文件**、段落、相对父版本的 +/− 条数；「用对话更新」后按你的修改点写入 |
| 面试模拟 | 选类型与简历版本 → 随机出题；记录里有每题的问题、回答、档位（A/B/C/D）、维度、点评与总体结论 |
| 复盘 | 记录真实面试 + 三段式复盘（答得好 / 破防点 / 待补事实 / 下次怎么答） |

所有「用对话…」按钮都会新开会话并预填提示词，按回车发送。

### 模拟面试怎么跑

面板点「随机出题并开始」后，会话里的助手会：

1. `offerloop_read` 读取目标岗位 JD 与指定简历版本；
2. 随机生成 5 个问题（业务 2、专业 2、动机/HR 1，顺序打乱，避开上一场）；
3. 一次一问，回答后追问一层；
4. 每题记录档位 A/B/C/D、维度（需求判断/优先级/指标口径/推进/复盘/表达）与一句点评；
5. 结束时给总体结论、3 条优势、3 个待补；
6. 用 `offerloop_write` 的 `interview.add`（mode=mock）写回面板。

## 数据

- 位置：`<workspace>/.offerloop.json`（单文件 JSON，可 diff、可 review）
- 结构：`profile / target / jobs / resumes / interviews / retros / todos`
- 简历版本：`{ id, title, parentId, targetJobId, file, sections[{heading,bullets[{text}]}], diffSummary }`；`file` 是相对数据目录的简历文件路径，空串表示未指定
- 面试记录：`{ mode: 'mock' | 'real', round, questions[{q,a,score,dimension,comment}], overall{score,summary,strengths,gaps} }`
- 写入：Host 统一校验后原子写（临时文件 + rename）；损坏时自动备份为 `.corrupt-<time>`
- 旧版（含证据库）的数据文件在首次读取时自动迁移：删除 `evidence`、清理导入类待办、版本号升到 2

### offerloop_write 的 action

`target.set/clear`、`job.add/update/delete`、`resume.add/update/delete`、
`interview.add/update/delete`、`retro.add/delete`、`todo.add/toggle/delete`。

`resume.update` 写入段落（`file` 可选，用来指定该版本的简历文件）：

```json
{
  "action": "resume.update",
  "payload": {
    "id": "R-000",
    "file": "简历/我的简历-通用.docx",
    "sections": [{ "heading": "职业概述", "bullets": [{ "text": "…" }] }],
    "diffSummary": ["首屏加入 AI 实践线索"]
  }
}
```

`file` 传空串即清除；传不存在或不在数据目录内的路径会报错。

## 架构

- `index.js`：Host 半。`/offerloop/api` 路由（经 `ctx.connection.requestRejection` 鉴权，未授权 401）、`/offerloop/api/files`（数据目录文件列表，供简历文件选择器使用）、`offerloop_read` / `offerloop_write` 两个工具、一段稳定的系统提示段。
- `client.js`：Client 半。注册 `sidebar.panellist` 的 `offerloop` 图标与 `main` 的 `offerloop` 面板；只依赖浏览器模块表里的 React，不 import 任何 Harness Client 包。
- `cordis.patch.yml`、`locale/*.json`、`icon.svg`：插件行与显示元数据。

## 目录结构

```
dsh-offerloop/
├── package.json        # 声明 dsh.bundle.patch 与 dsh.client
├── cordis.patch.yml    # 往 profile 里插入 offerloop 行
├── index.js            # Host 半：数据路由、Agent 工具、提示段
├── client.js           # Client 半：侧边栏图标 + 整页工作台
├── locale/{zh,en}.json # 插件管理页的显示名与描述
├── icon.svg
└── README.md
```

## 当前版本边界

已实现并验证：数据目录（顶栏切换 + 文案说明）、目标岗位变量、简历版本（含指定简历文件）与段落写入、模拟面试记录（题目/回答/档位/维度/点评/总体）、真实面试与复盘、两个 Agent 工具、鉴权路由、数据目录文件列表接口、v1→v2 数据迁移。

尚未实现：自动扫描或批量导入简历文档（只有显式指定的那一份会被读取）、面试语音、复盘趋势、面板内直接导出 docx/pdf。

## 开发提示

- 改 `client.js`：Client HMR 会热更，刷新页面即可。
- 改 `index.js`：`plugin_manager` 先 `remove_bundle` 再 `install_bundle` 会重新加载 Host 模块（本机已验证）；若个别环境仍不生效，再重启 Harness。
- 面板没有会话绑定：要「用对话处理」只能预填新会话草稿。
- 面板切换即卸载：真源永远在文件里，Client 只做派生缓存。