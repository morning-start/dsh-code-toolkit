# @morning-start/dsh-code-toolkit

DeepSeek Harness 的代码工具箱：**审查**、**精炼**与**隐私清理**三件独立的检查，都由独立上下文的原生 spawn agent 执行，提示词按 skill 的方式分层组织，并附带可运行的评测。

```text
/code-review     审查改动，出带优先级的报告（只读）
/code-simplify   简化代码，功能逐位不变（默认 dry-run，--apply 才写）
/code-scrub      清理隐私信息：密钥、密码、账号、本机路径（默认只报，报告脱敏）
/code-status     查看状态或最近一次结果
/code-cancel     取消运行中的任务
```

选范围可以交互选（本轮改动 / 基准分支 / 某次提交 / 自定义），也可以一行写清：

```text
/code-review --base main
/code-review --commit 1a2b3c4
/code-simplify --files src/app.js,src/util.js
/code-simplify --apply
```

## 提示词不是两个文件

`agents/` 按 skill 的三层结构组织，而不是把全部规则塞进一个 prompt：

```text
agents/review/
  AGENT.md                 核心 persona：范围解析、八道门、优先级、输出契约
  references/rubric.md     完整审查标准（Codex 原文，标注来源与许可）
  references/severity.md   P0–P3 的判定锚点
  references/evidence.md   证据要求：能指出到达缺陷的路径
  references/output.md     JSON 字段规则与常见被拒情形
  examples/findings.md     三条真实级别的示例
  examples/clean.md        "干净改动应当零发现"的示例
agents/simplify/
  AGENT.md
  references/operations.md            六类操作及其判定测试
  references/anti-patterns.md         反模式（含 Claude code-simplifier 的 balance 规则）
  references/behavior-preservation.md 15 项"静默变化"清单
  references/verification.md          各语言可用的验证手段
  references/conventions.md           项目规范优先级
  examples/plan.md / apply.md         计划与结果的写法
agents/scrub/
  AGENT.md                 核心 persona：脱敏铁律、范围、分类、优先级、输出契约
  references/patterns.md   密钥/账号/本机路径的检索族
  references/false-positives.md  占位符、环境变量引用、公开元数据、测试夹具
  references/redaction.md  各类文件的替换形态与验证
  examples/report.md       一条脱敏后的合格发现
  examples/clean.md        "看着可疑但干净"的仓库
```

`AGENT.md` 是常驻部分（每个命令都注入），`references/` 与 `examples/` 是**按需加载**：子 agent 手上有读文件工具，persona 里写明"什么时候该读哪一份"。这样核心提示词保持短，深度内容随取随用，和 skill 的 progressive disclosure 是同一套机制——区别只在触发方式和运行方式（见下）。

## 为什么是插件而不是技能

技能的 name + description **每一轮都在 system prompt 的技能目录里**，正文要靠模型自己判断命中才加载；它既不是"平时不显示"，也不保证"该用的时候用上"。而这三个诉求恰好是 command 的语义：

| | command（本插件） | skill |
|---|---|---|
| 触发 | 用户输入 `/xxx` | 模型自行判断 |
| 常驻上下文开销 | 0 | 名称+描述，每轮 |
| 能否开独立上下文 | 能 | 不能，只是文本 |
| 能否约束工具/模型 | 能 | 不能 |
| 状态、取消、落盘 | 能 | 不能 |

最硬的一条是隔离：主 agent 审查自己刚写的改动会带着"我当时为什么这么写"的记忆；简化也会顺着自己的思路改。skill 只能把文本塞进当前上下文，正好抹掉这个性质。所以 persona 放在插件里，按 skill 的方式组织。

## 评测

确定性部分（不需要模型，一秒跑完，适合当提交门禁）：

```powershell
npm test        # 或 node evals/run.mjs --verbose
```

它检查：提示词树完整（每个被引用的文件存在、每份文件都被引用、每个角色至少有一个用例）、核心 persona 不超预算、解析器能扛住各种畸形输出、渲染器生成的 `file:line` 链接、范围提示词拼装、包元数据。

模型质量部分，`evals/ACCEPTANCE.md` 定义了跑法：把 `evals/cases/` 里的用例物化成临时 git 仓库，让 agent 审，再用 `score.mjs` 对照标注打分（召回、误报、优先级准确率、格式合规），并与"同格式但不给 persona"的基线对照。

```powershell
node evals/case-setup.mjs --case 01-null-header --out tmp/eval/01
# 跑 agent，把原始回复存到 tmp/eval/01/with/report.txt
node evals/score.mjs --case 01-null-header --report tmp/eval/01/with/report.txt
```

用例一正一反成对：审查侧有"删掉默认参数而调用方还在"（要看调用点）、"纯改名"（要敢报零发现）、"计数器提到模块作用域"（要想到第二次调用）；简化侧有"四层嵌套"（该动手）和"看起来能合并成 `||` 但会吞掉 `NaN`"（该收手）；清理侧有"提交了 `.env`、内部邮箱、本机路径"（该报）和"全是占位符与公开元数据"（要敢报零发现）。

## 加新能力

新增角色、新增命令、或实质性修改 persona，都要走同一条流程：设计 → 分层写 persona → 建正反两个评测用例 → 跑无 persona 的基线对照 → 把结果写进 `evals/results/`。三条验收标准同时满足才算做完：`npm test` 全绿、至少一个用例能区分 persona 和基线（或写明为什么不能）、结果落盘并写清下一轮改什么。

完整约定见 [AGENTS.md](AGENTS.md)，评测方法见 [evals/ACCEPTANCE.md](evals/ACCEPTANCE.md)。

## 安装

```powershell
plugin_manager { action: "install_bundle", target: "<本目录绝对路径>" }
```

安装后重启宿主，在新会话里输入 `/code-review` 或 `/code-simplify`。

## 限制

- 需要独立上下文的原生 `spawn` provider，缺失时报错而非降级。
- `/code-simplify` 默认不改文件；`--apply` 后子 agent 必须验证，不过则回退。
- 子 agent 禁止调用委派类工具，不会二次扇出。
- 报告落盘在 `$DSH_HOME/code-toolkit/`，重开会话后 `/code-status` 仍可读；跨机器不共享。

完整说明见 [docs/DETAIL.md](docs/DETAIL.md)，评测方法见 [evals/ACCEPTANCE.md](evals/ACCEPTANCE.md)。
