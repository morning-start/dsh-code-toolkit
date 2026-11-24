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
    'cmd.simplify': '简化代码：功能逐位不变，默认只出计划',
    'cmd.review': '审查代码改动：独立 agent 出带优先级的报告',
    'cmd.status': '查看代码质量任务状态或最近结果',
    'cmd.cancel': '取消当前代码质量任务',
    'hint.scope': '留空选择范围；或 --files a.js,b.js / --base main / --commit <sha> / --apply / 自定义说明',
    'select.scope.title': '代码质量',
    'select.scope.question': '要处理哪部分代码？',
    'option.current': '本轮改动（工作区 + 已暂存）',
    'option.current.desc': '与 HEAD 对比',
    'option.base': '对比基准分支',
    'option.base.desc': '与指定的分支或引用对比',
    'option.commit': '某次提交',
    'option.commit.desc': '只看一个提交引入的改动',
    'option.custom': '自定义说明',
    'option.custom.desc': '直接写下要处理的范围或要求',
    'select.base': '选择基准分支，也可输入其他分支或引用',
    'select.commit': '选择提交，也可输入其他提交 SHA 或引用',
    'select.instructions': '请输入要处理的范围或要求',
    'error.noCwd': '当前会话没有工作目录。',
    'error.noProvider': '当前宿主缺少独立上下文的原生 spawn provider，无法运行独立 agent。',
    'error.noActivation': '当前宿主缺少原生子 agent 启动接口，请升级 DeepSeek Harness。',
    'error.noGit': '不是 Git 仓库，或 git 不可用：',
    'error.aborted': '操作已取消。',
    'error.noResult': '子 agent 没有返回报告。',
    'error.busy': '当前会话已有代码质量任务在运行，请等待或先取消。',
    'error.noScope': '没有选中有效范围。',
    'error.emptyInstructions': '自定义说明不能为空。',
    'error.reportDirectory': 'reportDirectory 必须是绝对路径。',
    'error.model': '模型名不能为空。',
    'status.none': '当前会话还没有代码质量任务记录。',
    'status.running': '正在运行：',
    'status.last': '最近一次：',
    'status.interrupted': '上次任务有启动记录但没有完成报告，可以重新运行。',
    'cancel.none': '没有正在运行的代码质量任务。',
    'cancel.done': '已请求取消。',
    'report.verdict': '结论：',
    'report.noFindings': '没有发现需要处理的问题。',
    'report.limitation': '未覆盖：',
    'mode.dryRun': 'dry-run（未改文件）',
    'mode.apply': 'apply（已改文件）',
  },
  en: {
    'cmd.simplify': 'Simplify code without changing behavior; plans by default',
    'cmd.review': 'Review a change with an independent agent and prioritized findings',
    'cmd.status': 'Show code-quality task status or the latest result',
    'cmd.cancel': 'Cancel the running code-quality task',
    'hint.scope': 'Leave empty to choose a scope; or --files a.js,b.js / --base main / --commit <sha> / --apply / custom instructions',
    'select.scope.title': 'Code quality',
    'select.scope.question': 'Which code should be handled?',
    'option.current': 'Changes in this session',
    'option.current.desc': 'Compared with HEAD',
    'option.base': 'Against a base branch',
    'option.base.desc': 'Compared with the chosen branch or ref',
    'option.commit': 'One commit',
    'option.commit.desc': 'Only what that commit introduced',
    'option.custom': 'Custom instructions',
    'option.custom.desc': 'Describe the scope or requirement directly',
    'select.base': 'Choose a base branch, or type another branch or ref',
    'select.commit': 'Choose a commit, or type another SHA or ref',
    'select.instructions': 'Describe the scope or requirement',
    'error.noCwd': 'This session has no working directory.',
    'error.noProvider': 'This host has no independent-context native spawn provider, so no isolated agent can run.',
    'error.noActivation': 'This host has no native subagent activation API; upgrade DeepSeek Harness.',
    'error.noGit': 'Not a Git repository, or git is unavailable: ',
    'error.aborted': 'Cancelled.',
    'error.noResult': 'The subagent returned no report.',
    'error.busy': 'A code-quality task is already running in this session; wait or cancel it first.',
    'error.noScope': 'No valid scope was selected.',
    'error.emptyInstructions': 'Custom instructions cannot be empty.',
    'error.reportDirectory': 'reportDirectory must be an absolute path.',
    'error.model': 'A model name cannot be empty.',
    'status.none': 'No code-quality task recorded in this session yet.',
    'status.running': 'Running: ',
    'status.last': 'Last run: ',
    'status.interrupted': 'The previous run started but never finished; run it again.',
    'cancel.none': 'No code-quality task is running.',
    'cancel.done': 'Cancellation requested.',
    'report.verdict': 'Verdict: ',
    'report.noFindings': 'No findings worth acting on.',
    'report.limitation': 'Not checked: ',
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
