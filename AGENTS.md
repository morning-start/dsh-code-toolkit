# AGENTS.md

本文件是给在本仓库里工作的 agent 的项目约定。读完它再动手；它描述的流程不是仪式，而是这个插件唯一能证明自己有效的办法。

## 这个项目是什么

DeepSeek Harness 插件，提供五条命令：`/code-review`（审查并修复发现的问题，`report` 只出报告）、`/code-simplify`（精炼，默认直接改）、`/code-scrub`（找密钥、账号、本机路径，默认直接改）、`/code-caption`（把难任务装进显式循环，过程落成台账）和 `/pua`（把「失败换方法、完成要证据」的协议注入当前会话）。三件检查默认把任务交给**当前会话**，加 `sub` 才换成**独立上下文的原生 spawn agent**，加 `report` 只出报告不写盘。

## 每条命令的特性

七条命令共用一个外壳（`SessionCommand`），但**不共用同一份契约**。外壳保证的是行为一致：秒回、定范围、失败发说明、写 journal。契约取决于这条命令要解决什么问题——把 caption 的循环套到 review 上，只会多一层空转。

| 命令 | 解决什么 | 生命周期 | 契约 | 能不能改文件 |
| --- | --- | --- | --- | --- |
| `/code-review` | 一次判断：这段改动有没有问题，并把它修掉 | 一次性 | 两段式：默认先报告再修（修完必须跑门禁），`report` 只出报告 | 是，默认改 |
| `/code-simplify` | 一次改造：功能不变的前提下简化 | 一次性 | 两段式：`report` 出方案 → 人看过 → 再跑一次执行 | 是，默认写 |
| `/code-scrub` | 一次清理：找出并移除隐私信息 | 一次性 | 同上，报告默认脱敏 | 是，默认写 |
| `/code-caption` | 复杂任务：跨轮、要验证、要台账 | **持续**，多轮多步 | 完整契约：需求 → 调查 → 方案 → **人审** → 执行 → 测试 → 人确认 → 改文档（或改文档流程） | 是，按方案 |
| `/pua` | 一次注入：给当前会话装纪律 | 一次性，注入即结束 | 无审核环节——它不做事，只改做事的方式 | 否 |
| `/code-status` | 查询：干到哪了 | 只读 | 无 | 否 |
| `/code-cancel` | 中断：停掉正在跑的 | 只读 | 无 | 否 |

判据：**只有 caption 需要完整契约**，因为它是唯一跨轮、唯一要连续跑门禁、唯一有「方案被推翻要回头改」的命令。其余命令是一次单独的行动——它们的「审核」要么压缩成一个开关（`report`），要么根本不存在（status、cancel）。

所以：**不要给一次性命令加循环、加台账、加审核门禁**；也不要因为外壳统一，就以为契约也该统一。新增命令时先回答上表那四列，再决定它属于哪一类。

## 目录契约

| 路径 | 放什么 | 谁读 |
| --- | --- | --- |
| `index.js` | 命令声明（每条一份 spec）、配置校验、persona 装载 | 宿主 |
| `src/command.js` | `SessionCommand`：所有命令共用的会话交互外壳（注册、范围、投递、journal） | `index.js`、测试 |
| `src/` | 运行时、报告解析与渲染、i18n、journal、scope 解析、身份解析 | `index.js`、测试 |
| `agents/<role>/AGENT.md` | 常驻 persona，注入子 agent 的 system prompt | 子 agent |
| `agents/<role>/references/` | 深度材料，子 agent 按需读 | 子 agent |
| `agents/<role>/examples/` | 合格/不合格的样例 | 子 agent |
| `evals/` | 确定性测试、评测用例、打分器、验收流程、结果记录 | 维护者、CI（**进 git，不进 npm 包**） |
| `locale/` | 插件元数据（标题、描述） | 宿主插件面板 |
| `tmp/` | 一次性产物，已 gitignore | 无 |

插件详情页回落到 `README.md`：宿主渲染详情文档时不支持图片，单图文档只会显示成一行 alt 文字，所以不要声明 `meta.detail`。

## 硬约束

**1. 不引入运行时依赖。** 这个插件以 `link:` 方式装在 profile 里，Node 从真实路径（`<repo>`）解析裸模块名，拿不到 profile 的 `node_modules`。所以只能用 `node:` 内置模块和 `ctx` 上的服务。想要一个能力时先找宿主服务，找不到再考虑改设计，不要 `npm install`。

**2. 只注册 command，不注册 tool。** 模型不该在写代码时"顺手"调用审查或简化。命令由人触发，这是这个插件存在的意义之一。

**3. persona 必须分层。** `AGENT.md` 控制在 12KB 以内（测试强制），深度内容进 `references/`，`AGENT.md` 末尾必须有"什么时候读哪一份"的表。理由：常驻上下文要短，细节随取随用。

**4. 每份 references/examples 都必须被 `AGENT.md` 引用。** 没被引用的文件等于不存在——子 agent 永远不会知道该读它。测试会失败。

**5. 引用外部材料必须标来源。** 文件头写 `Source:`，带仓库/commit/许可。`references/rubric.md` 和 `references/anti-patterns.md` 是范例。

**6. persona 用英文写，输出语言由运行时决定。** `src/i18n.js` 的 `outputLanguage()` 会把目标语言拼进任务；同一份 persona 服务 8 种输出语言。不要为某种语言复制一份 persona。

**7. 新增 i18n key 必须同时进 `zh` 和 `en`。** 测试会扫描 `index.js` 里用到的 key。

**8. 新增目录要进 `package.json` 的 `files`。** 否则打包后运行时报找不到文件。测试会检查。

**9. 所有命令都通过 `SessionCommand` 注册。** `index.js` 里只写声明，不直接 `ctx.commands.register`；测试会检查。命令之间的一致性靠这个外壳保证，绕开它就等于又写了一遍。

**10. 投递给宿主的消息必须是完整的 `UserMessage`。** `agent.steer` / `agent.followup` / `agent.inject` 收的是完整消息，宿主把**它原样**写成一条 `user/message` 会话事件。手写 `{ content, source }` 会缺少 `id` 和 `role`，本次会话看不出异常，但**下次加载会话时校验失败，整个对话再也打不开**（`session event at seq N lacks an identified message`）。一律用 `src/delivery.js` 的 `userMessage()` 构造；测试会扫描 `.steer({` / `.followup({` 这类对象字面量调用。

## 新能力的流程

**"新能力"指**：新增一个 agent role、新增一个命令、或对现有 persona 做实质性修改（改判定标准、改输出契约、加一类操作）。改错别字、调措辞不算。

新能力必须走完这五步，缺一步就是没做完：

### 1. 设计

写清楚四件事，可以直接写进 issue 或提交说明：

- **触发**：用户怎么用上它（命令名、参数、留空时的交互）。
- **特性**：先填「每条命令的特性」那张表的四列——解决什么、生命周期、契约、能不能改文件。填不出「生命周期」，就说明还没想清楚它是不是一次单独的行动。
- **输入**：它拿到什么（diff、文件、自定义说明），以及拿不到时怎么办。
- **输出契约**：返回什么结构，谁来解析，解析失败怎么退化。
- **失败模式**：最可能出的三种错（漏报、误报、格式崩），各自怎么被测试发现。

### 2. 分层写 persona

```
agents/<role>/AGENT.md         核心：角色、流程、判定标准、输出契约、reference 表
agents/<role>/references/*.md  深度：完整标准、判定锚点、检查清单、验证手段
agents/<role>/examples/*.md    样例：一个够好的、一个不够好的，并解释为什么
```

判据：`AGENT.md` 单独拿出来也要自足——读不到 references 时仍能工作，只是做得粗一点。

### 3. 建评测用例

**至少两个**，一正一反：

- 一个"应该发现问题 / 应该动手"的用例。
- 一个"不该报 / 不该动"的用例——误报比漏报更能杀死一个审查工具。

用例放在 `evals/cases/<NN>-<slug>/`，结构见下节。用例的陷阱要满足一条：**只看 diff 会看错**。如果一眼就能看出来，它测不出 persona 有没有用。

### 4. 跑基线对照

同一份任务、同一套输出格式，**不给 persona** 跑一遍。格式必须一致，否则比的是 JSON 合规度而不是判断质量。

### 5. 记录结果

写 `evals/results/iteration-N.md`：表格（用例 × 配置 × 指标）、哪几格真正有区分度、哪几格没有、下一步改什么。

**验收标准**（三条同时满足才算完成）：

1. `npm test` 全绿；
2. 至少一个用例能区分 persona 和基线，或者明确写下"本轮无用例具备区分度，原因是什么"；
3. 结果落盘，且写清下一轮要改的那一件事。

## 评测用例的格式

```
evals/cases/<NN>-<slug>/
  README.md        这个用例测什么、陷阱在哪、期望是什么
  before/          改动前的树（review）或当前代码（simplify）
  after/           改动后的树（review 用；simplify 不需要）
  expected.json    机器可读的标注
```

`expected.json` 两种：

```json
// review
{ "mode": "review", "clean": false, "scope": "uncommitted",
  "findings": [{ "id": "...", "file": "src/a.js", "line": 3, "lineTolerance": 2, "priority": 1, "description": "..." }],
  "allowedExtras": 1 }

// simplify
{ "mode": "simplify", "dryRun": true,
  "requireGroups": [["src/a.js"], ["nest", "flatten"], ["unchanged", "行为不变"]],
  "forbid": ["已修改"] }
```

标注的要求：**机器能判**。`line` 给容差，`priority` 允许差一级，`requireGroups` 每组至少命中一个词。判不了的东西（"计划写得好不好"）不要塞进 `expected.json`，写进 `README.md` 由人看。

## 新增一个角色

1. 建 `agents/<role>/AGENT.md` + 至少两份 references + 一份 examples。
2. 在 `index.js` 里 `loadPersona('<role>')`，然后声明一条 `SessionCommand`（`kind: 'task' | 'inject' | 'local'`），不要自己注册命令。
3. 在 `evals/cases/` 加至少一个 `mode` 等于该 role 的用例——测试会检查每个 role 都有用例。
4. 更新 `README.md` 的命令表与结构树、`locale/*.json` 的描述。
5. `package.json` 不需要动（`agents` 已经在 `files` 里）。
6. 跑 `npm test`，跑一轮对照，写 `evals/results/iteration-N.md`。

## 修改 persona

一次只改一处，改完重跑全部用例。对照结果决定改什么：

| 现象 | 该改什么 | 不该改什么 |
| --- | --- | --- |
| 漏报 | 加**步骤**（去哪看、看什么），不是加"要仔细" | 不要把判定标准写成口号 |
| 误报 | 加**门槛**（什么条件下不算发现） | 不要写"保守一点"，模型没法按形容词校准 |
| 优先级错 | 给**具体锚点**（什么情况是 P0，什么只是 P1） | 不要加重形容词 |
| 格式崩 | 改 `AGENT.md` 里的 schema 块，使其与 `src/report.js` 接受的一致 | **不要**为通过测试放松解析器 |
| 跑得慢/啰嗦 | 删掉不产生判断的段落 | 不要靠"简洁"两个字 |

改完看的是原始回复，不只看分数——分数告诉你失败了，回复告诉你为什么。

## 常用命令

```powershell
npm test                                   # 确定性测试（96 项，不需要模型）
node evals/run.mjs --verbose               # 同上，逐项打印
node evals/case-setup.mjs --case 03-shared-retry-counter --out tmp/eval/03
node evals/score.mjs --case 03-shared-retry-counter --report tmp/eval/03/with/report.txt
```

`evals/ACCEPTANCE.md` 是这套流程的完整说明（指标定义、跑法、方差、局限），改流程时两边一起改。

## 改 DSH 接口之前

这个插件用到的宿主 API（`ctx.commands`、`ctx.subagents.startActivation`、`ctx.userQuestions`、`ctx.on('agent/created')`、`ctx.tools.restrict`、`ctx.systemPrompt.section`）都随 DSH 版本变。动它们之前先加载 `dsh-doc` 技能，读当前安装版本的文档和源码，别凭记忆写。

## 不要做

- 不要给一次性命令加循环、台账或审核门禁：它们是一次单独的行动，套上 caption 的契约只会多一层空转。
- 不要把 persona 合回一个文件。
- 不要把 `/code-caption` 改成 spawn 子 agent：它要跨轮、要问用户、要连续跑门禁，一次性的子 agent 会把这三件事都丢掉。
- 不要让分派绕过独占路径：分析线只读可以并行，实现线两个写者碰同一个文件（含 barrel、配置、共用测试）就是设计出来的冲突，合并后没人能解释红在哪。
- 不要为让测试通过而放松解析器或删检查。
- 不要注册 tool，也不要给子 agent 开放委派类工具。
- 不要引入 npm 依赖。
- 不要在 `tmp/` 里放需要长期保留的东西。
- 不要在没跑对照的情况下声称"改进了"。
