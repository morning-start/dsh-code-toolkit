/**
 * Locale and strings for the plugin's own chrome.
 *
 * Content language follows the host's `locale.preference` setting when the
 * host exposes it (all eight official languages); command descriptions and
 * errors are translated for Chinese and English and fall back to English.
 */

export const SUPPORTED_LOCALES = ['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt']

const LANGUAGE_NAMES = {
  zh: 'Simplified Chinese',
  en: 'English',
  ja: 'Japanese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ru: 'Russian',
  pt: 'Portuguese',
}

const MESSAGES = {
  zh: {
    'cmd.simplify': '简化代码：功能逐位不变，默认直接改整个项目',
    'cmd.review': '审查代码改动：默认出报告并修复发现的问题，加 report 只出报告',
    'cmd.scrub': '清理隐私信息：密钥、密码、账号、本机路径，默认直接改',
    'cmd.caption': '把难任务装进 caption 循环：一步一验，过程落成台账',
    'hint.caption': '留空即继续当前任务；或写下任务与验收判据',
    'caption.installed': '已装入 caption 循环：台账写到 {dir}，每一步都要有命令和它的结果。',
    'caption.reinstalled': 'caption 循环已在本次会话里，只补了任务：台账 {dir}，继续按循环走。',
    'error.noSteer': '当前宿主不支持向会话注入输入（agent.steer 不可用）。',
    'error.noFollowup': '当前宿主不支持向会话投递任务（agent.followup 不可用）。',
    'cmd.queued': '已交给当前会话，范围：{scope}；完成后结果会作为一条消息发回。',
    'cmd.queuedSub': '已交给独立子 agent，范围：{scope}；完成后结果会作为一条消息发回。',
    'cmd.queuedPlan': '已请它先出方案，范围：{scope}，不改任何文件；方案回来后你确认，再执行。',
    'cmd.queuedPlanSub': '已请独立子 agent 先出方案，范围：{scope}，不改任何文件；方案回来后你确认，再执行。',
    'cmd.pua': '给当前会话装上 PUA 协议：失败就换方法、拿证据、别敷衍',
    'hint.pua': '留空用默认风味；或 list / alibaba / huawei / musk 等',
    'pua.installed': '已装上 PUA 协议（{flavor}）：同类尝试失败两次就换方法，说完成必须给出命令和输出。',
    'pua.list': '可用风味：',
    'cmd.status': '查看代码工具箱任务状态或最近结果',
    'cmd.cancel': '取消当前代码工具箱任务',
    'hint.scope': '留空即整个项目（当前分支）；或 --files a.js,b.js / --branch main（对比哪个分支，默认基线）/ --commit <sha> / 自定义说明；加 sub 用子 agent，加 report 只出报告',
    'hint.scrub': '留空即整个项目；或 --files a.js,.env / 自定义说明；加 sub 用子 agent，加 report 只出报告',
    'error.noCwd': '当前会话没有工作目录。',
    'error.noProvider': '当前宿主缺少独立上下文的原生 spawn provider，无法运行独立 agent。',
    'error.noActivation': '当前宿主缺少原生子 agent 启动接口，请升级 DeepSeek Harness。',
    'error.noGit': '不是 Git 仓库，或 git 不可用：',
    'error.aborted': '操作已取消。',
    'error.noResult': '子 agent 没有返回报告。',
    'error.busy': '当前会话已有代码工具箱任务在运行，请等待或先取消。',
    'error.noScope': '没有选中有效范围。',
    'error.emptyScope': '没有可审查的改动：当前分支与基线一致，工作区也是干净的。试试 --branch <别的分支>、--commit <sha> 或 --files <路径>。',
    'error.emptyInstructions': '自定义说明不能为空。',
    'error.reportDirectory': 'reportDirectory 必须是绝对路径。',
    'error.model': '模型名不能为空。',
    'error.ledgerDirectory': 'ledgerDirectory 不能为空。',
    'error.runTimeout': 'runTimeoutMinutes 必须是非负数（0 表示不限制）。',
    'error.planMaxAge': 'planMaxAgeMinutes 必须是非负数（0 表示不限制）。',
    'status.none': '当前会话还没有代码工具箱任务记录。',
    'status.running': '正在运行：',
    'status.last': '最近一次：',
    'status.interrupted': '上次任务有启动记录但没有完成报告，可以重新运行。',
    'status.submitted': '已提交到当前会话，结果在会话里：',
    'cancel.none': '没有正在运行的代码工具箱任务。',
    'cancel.done': '已请求取消。',
    'report.verdict': '结论：',
    'report.noFindings': '没有发现需要处理的问题。',
    'report.limitation': '未覆盖：',
    'report.fixed': '已修复',
    'report.verifiedBy': '验证：',
    'mode.dryRun': 'dry-run（未改文件）',
    'mode.apply': 'apply（已改文件）',
  },
  en: {
    'cmd.simplify': 'Simplify code without changing behavior; writes the whole project by default',
    'cmd.review': 'Review a change and fix what it finds; add report for the report only',
    'cmd.scrub': 'Find and redact secrets, credentials, and personal data; writes by default',
    'cmd.caption': 'Run a hard task through the caption loop: one step, one proof, a ledger',
    'hint.caption': 'Leave empty to continue the current task; or state the task and its acceptance criteria',
    'caption.installed': 'Caption loop installed: keep the ledger in {dir}, with a command and its result for every step.',
    'caption.reinstalled': 'The caption loop is already installed in this session; only the task was added. Ledger: {dir}.',
    'error.noSteer': 'This host cannot inject input into the session (agent.steer is unavailable).',
    'error.noFollowup': 'This host cannot queue a task into the session (agent.followup is unavailable).',
    'cmd.queued': 'Handed to this session; scope: {scope}. The result arrives as a message when the run finishes.',
    'cmd.queuedSub': 'Handed to an isolated agent; scope: {scope}. The result arrives as a message when the run finishes.',
    'cmd.queuedPlan': 'Asked for a plan first; scope: {scope}, no files will change. Confirm it when it arrives, then run the command again to execute.',
    'cmd.queuedPlanSub': 'Asked the isolated agent for a plan first; scope: {scope}, no files will change. Confirm it when it arrives, then run the command again to execute.',
    'cmd.pua': 'Install the PUA protocol in this session: change method, bring evidence, stop shrugging',
    'hint.pua': 'Leave empty for the default flavor; or list / alibaba / huawei / musk',
    'pua.installed': 'PUA protocol installed ({flavor}): two failures of the same kind mean change the method, and "done" needs a command and its output.',
    'pua.list': 'Available flavors:',
    'cmd.status': 'Show code-toolkit task status or the latest result',
    'cmd.cancel': 'Cancel the running code-toolkit task',
    'hint.scope': 'Leave empty for the whole project on the current branch; or --files a.js,b.js / --branch main (which branch to compare against; the base by default) / --commit <sha> / custom instructions; add sub for a subagent, report for a plan only',
    'hint.scrub': 'Leave empty for the whole project; or --files a.js,.env / custom instructions; add sub for a subagent, report for a plan only',
    'error.noCwd': 'This session has no working directory.',
    'error.noProvider': 'This host has no independent-context native spawn provider, so no isolated agent can run.',
    'error.noActivation': 'This host has no native subagent activation API; upgrade DeepSeek Harness.',
    'error.noGit': 'Not a Git repository, or git is unavailable: ',
    'error.aborted': 'Cancelled.',
    'error.noResult': 'The subagent returned no report.',
    'error.busy': 'A code-toolkit task is already running in this session; wait or cancel it first.',
    'error.noScope': 'No valid scope was selected.',
    'error.emptyScope': 'Nothing to review: the branch matches its base and the working tree is clean. Try --branch <another branch>, --commit <sha>, or --files <path>.',
    'error.emptyInstructions': 'Custom instructions cannot be empty.',
    'error.reportDirectory': 'reportDirectory must be an absolute path.',
    'error.model': 'A model name cannot be empty.',
    'error.ledgerDirectory': 'ledgerDirectory cannot be empty.',
    'error.runTimeout': 'runTimeoutMinutes must be a non-negative number (0 disables the limit).',
    'error.planMaxAge': 'planMaxAgeMinutes must be a non-negative number (0 disables the limit).',
    'status.none': 'No code-toolkit task recorded in this session yet.',
    'status.running': 'Running: ',
    'status.last': 'Last run: ',
    'status.interrupted': 'The previous run started but never finished; run it again.',
    'status.submitted': 'Submitted to this session; the result is in the conversation: ',
    'cancel.none': 'No code-toolkit task is running.',
    'cancel.done': 'Cancellation requested.',
    'report.verdict': 'Verdict: ',
    'report.noFindings': 'No findings worth acting on.',
    'report.limitation': 'Not checked: ',
    'report.fixed': 'Fixed',
    'report.verifiedBy': 'Verified by: ',
    'mode.dryRun': 'dry-run (no files changed)',
    'mode.apply': 'apply (files changed)',
  },
}

/** Narrow any tag to one of the eight supported locales. */
export function resolveLocale(value) {
  if (typeof value !== 'string' || !value.trim()) return 'zh'
  const tag = value.trim().toLowerCase()
  const hit = SUPPORTED_LOCALES.find((locale) => tag.startsWith(locale))
  return hit ?? 'en'
}

/** Read `locale.preference` from the host settings service, if it is there. */
export function readHostLocale(ctx, fallback) {
  try {
    const settings = ctx.get('settings')
    if (!settings || typeof settings.describe !== 'function') return fallback
    const forms = settings.describe()
    if (!Array.isArray(forms)) return fallback
    const form = forms.find((item) => item && typeof item === 'object' && item.ns === 'locale')
    const value = form?.value
    const preference = value && typeof value === 'object' ? value.preference : value
    return typeof preference === 'string' && preference.trim() ? resolveLocale(preference) : fallback
  } catch {
    return fallback
  }
}

/** Translate one key; unknown keys fall back to English, then to the key itself. */
export function translate(locale, key) {
  const table = MESSAGES[locale] ?? MESSAGES.en
  return table[key] ?? MESSAGES.en[key] ?? key
}

/** The sentence appended to a task so the child answers in the user's language. */
export function outputLanguage(locale) {
  return `Write all user-facing text in ${LANGUAGE_NAMES[locale] ?? LANGUAGE_NAMES.en}.`
}
