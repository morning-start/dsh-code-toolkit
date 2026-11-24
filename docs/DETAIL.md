# 代码质量

两个命令，都通过**独立上下文的原生 spawn agent** 执行：子 agent 不看当前对话历史，自己去读 Git、源码、调用方和测试。报告直接回到当前会话，并落盘一份。

## 命令

| 命令 | 作用 | 是否改文件 |
| --- | --- | --- |
| `/code-review` | 审查改动，出带优先级的报告 | 只读 |
| `/code-simplify` | 简化代码：功能逐位不变 | 默认 **dry-run**，只出计划；加 `--apply` 才写 |
| `/code-status` | 查看运行状态或最近一次结果 | — |
| `/code-cancel` | 取消正在运行的任务 | — |

## 选范围

留空命令会弹出选择：

- **本轮改动**：与 `HEAD` 对比（工作区 + 已暂存 + 未跟踪）
- **对比基准分支**：从本地分支里选，也可输入其他引用；合并基点由插件先算好（`git merge-base`，并处理"本地基准分支落后于 upstream"的情况）
- **某次提交**：从最近 100 条提交里选，也可输入 SHA
- **自定义说明**：直接写要处理的范围或要求

也可以一行写清，跳过选择：

```text
/code-review --base main
/code-review --commit 1a2b3c4
/code-simplify --files src/app.js,src/util.js
/code-simplify --apply
/code-simplify 只看 src/ 下新增的错误处理，别动测试
```

`--files` / `--base` / `--commit` 指定范围，`--apply` 单独作为写入开关，其余文本按自定义说明处理。

## 提示词的组织

persona 不是一个文件，而是 `agents/<role>/` 下的一棵树：

```text
AGENT.md               常驻：注入子 agent 的 system prompt
references/*.md        按需：子 agent 用读文件工具自己取
examples/*.md          按需：示范"什么算够好"
```

`AGENT.md` 末尾有一张表，写明"什么时候读哪一份"。任务里会给出 `Reference directory` 的绝对路径，子 agent 自己决定读不读、读哪份。读不到也不影响：核心指令是自足的。

这样做的好处和 skill 的 progressive disclosure 一样：常驻上下文短，深度内容不占预算；但触发是命令、运行是独立 agent，不依赖模型检索。

## 审查：八道门

一个候选问题要同时满足八条才算发现，否则丢掉——误报的代价是作者不再读报告：

1. 影响正确性 / 性能 / 安全 / 可维护性
2. 离散且可行动，不是"这块很乱"
3. 修复不要求项目本身没有的严谨度
4. **是本次改动引入的**，不是既有缺陷
5. 作者知道后会去修
6. 不依赖对作者意图的臆测
7. 若影响别处，能指出是哪一处
8. 明显不是有意为之

来源是 OpenAI Codex 的审查标准（`review_request.rs` @ `a592c38c`，Apache-2.0），在 `references/rubric.md` 里保留了原文要点与出处。

| 级别 | 含义 |
| --- | --- |
| **P0** | 正确性 / 数据丢失 / 安全 / 契约破坏，合并前必须修 |
| **P1** | 真实路径上的可能 bug、资源泄漏、竞态、缺失错误处理 |
| **P2** | 有具体代价的可维护性问题 |
| **P3** | 项目有明确约定时的风格问题 |

## 审查的输出

子 agent 被要求返回**一个 JSON 对象**（Codex 的 `findings` / `overall_correctness` / `overall_explanation` 结构）。插件解析后渲染成 Markdown：优先级标签 + `[路径:起–止](路径#L起-L止)` 的本地文件链接。

模型不总听话，所以解析器同时接受：裸 JSON、围栏里的 JSON、JSON 前后带说明、`priority` 写成 `"P2"`、`line_range` 写成 `"12-14"`、字段别名（`file` / `path` / `line`）。完全解析不出来时按纯文本原样透传——报告难看一点，好过丢掉。

## 简化的三条铁律

1. **功能逐位不变**——输入、输出、异常类型与消息、日志内容、副作用与顺序、边界与顺序行为，全不变。
2. **以项目既有规范为准**——先读 `AGENTS.md` / `CLAUDE.md` / `CONTRIBUTING` 与周边代码，不自创风格。
3. **清晰优先于简短**——压缩到看不懂不算简化。

六类操作：去冗余、降嵌套、提可读、清注释、改日志、去自证测试。反模式（顺手改功能、范围蔓延、过度简化、简化出抽象、删必要上下文、嵌套三元）写进 persona，由子 agent 自查。

"功能不变"是要论证的，不是要声称的：`references/behavior-preservation.md` 列了 15 项会静默变化的东西（异常类型、副作用顺序、`??` 与 `||`、迭代顺序、浮点、时区、懒求值、mutation…），apply 前逐项过。

## 为什么用独立 agent

主 agent 审查自己的改动会受上下文影响——它"知道"自己为什么这么写。独立 agent 只看到代码和 Git 历史，更接近下一个接手的人；同时不会把整段对话的代码快照背进去。

## 状态与落盘

每次运行在 `$DSH_HOME/code-quality/<session-hash>.json` 写一条记录（先写 running，完成后写 finished + 渲染好的报告）。所以：

- 重开会话后 `/code-status` 仍能读到最后一次结果
- 进程在运行中退出，记录停在 running，`/code-status` 会明确说"上次没跑完"

## 评测

`npm test` 跑确定性检查（提示词树、解析器、渲染器、范围拼装、包元数据），不需要模型。

模型质量用 `evals/ACCEPTANCE.md` 的流程：`evals/cases/` 里的用例物化成临时 git 仓库 → agent 审 → `score.mjs` 对照标注算召回/误报/优先级/格式 → 与"同格式、无 persona"的基线对照 → 改一处、重跑。

## 限制

- 需要宿主提供独立上下文的原生 `spawn` provider；缺失时命令直接报错，不会退化成主 agent 自查。
- `/code-simplify` 默认不改文件。要真正写入必须显式 `--apply`，且子 agent 改完必须验证；验证不通过会回退并如实报告。
- 子 agent 被禁止调用委派类工具（`subagent`、`workflow`、专家召唤等），不会二次扇出。
- 报告里的"完成"表示 agent 已返回，不保证它取到了全部 diff 或跑通了测试；具体限制以报告正文为准。

## 配置

| 键 | 作用 |
| --- | --- |
| `locale` | 命令文案与回退语言；未设置时跟随宿主 `locale.preference`。报告正文按宿主偏好在 8 种官方语言里选，命令描述只提供中/英，其余语言回退英文 |
| `simplifyModel` | 简化任务使用的模型；不填则跟随当前模型 |
| `reviewModel` | 审查任务使用的模型；不填则跟随当前模型 |
| `reportDirectory` | 报告落盘目录，必须是绝对路径；默认 `$DSH_HOME/code-quality` |
