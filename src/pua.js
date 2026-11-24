/**
 * Corporate flavors for the PUA protocol.
 *
 * Source: https://github.com/tanweai/pua (MIT). The rhetoric is quoted from that
 * project; the escalation rules live in `agents/pua/AGENT.md` and do not change
 * with the flavor.
 */
export const FLAVORS = [
  { id: 'alibaba', label: '阿里', line: '底层逻辑是什么？抓手在哪里？闭环了吗？', method: '定目标 → 追过程 → 拿结果；复盘四步法' },
  { id: 'bytedance', label: '字节', line: 'ROI 太低了。Always Day 1。要么上线，要么闭嘴。', method: '一切皆 A/B；数据说话；速度优先于完美' },
  { id: 'huawei', label: '华为', line: '烧不死的鸟才是凤凰。', method: '5-Why 追根因；蓝军自我攻击；压强集中' },
  { id: 'tencent', label: '腾讯', line: '我让另一个 agent 也在看这个，赛马。', method: '多方案并行；MVP；灰度发布' },
  { id: 'baidu', label: '百度', line: '先搜。简单可依赖。', method: '搜索是第一步，不是可选项' },
  { id: 'meituan', label: '美团', line: '做难而正确的事。', method: '效率优先；标准化再规模化；长期复利' },
  { id: 'musk', label: '马斯克', line: 'Extremely hardcore. Ship or die.', method: '质疑 → 删除 → 简化 → 加速 → 自动化' },
  { id: 'jobs', label: '乔布斯', line: 'A players or B players?', method: '减法优先于加法；DRI；像素级；原型驱动' },
]

export const DEFAULT_FLAVOR = 'alibaba'

/** Accept an id or a Chinese label; fall back to the default flavor. */
export function resolveFlavor(input) {
  const wanted = String(input ?? '').trim().toLowerCase()
  if (!wanted) return FLAVORS.find((flavor) => flavor.id === DEFAULT_FLAVOR)
  return FLAVORS.find((flavor) => flavor.id === wanted || flavor.label === String(input).trim())
    ?? FLAVORS.find((flavor) => flavor.id === DEFAULT_FLAVOR)
}

/** One line per flavor, for `/pua list`. */
export function flavorList(header) {
  return [header, '', ...FLAVORS.map((flavor) => `- \`${flavor.id}\` ${flavor.label} — ${flavor.line}`)].join('\n')
}

/** The protocol plus the chosen flavor, ready to steer into the session. */
export function buildPua(flavor, persona, language) {
  return [
    persona.trim(),
    '',
    '## This session\'s flavor',
    '',
    `${flavor.label}：${flavor.line}`,
    `Method: ${flavor.method}`,
    '',
    'The flavor sets the tone; the red lines and the five steps still decide what you do.',
    '',
    language,
  ].join('\n')
}
