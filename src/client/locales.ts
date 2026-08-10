/** `web-ui-notify` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'settings.title': '桌面通知',
  'settings.description': '当工具需要审批、向你提问、或轮次完成，而你正在浏览其他标签页时，弹出系统通知提醒你。',
  'settings.status.granted': '已开启',
  'settings.status.denied': '已被浏览器阻止',
  'settings.status.default': '未授权',
  'settings.status.unsupported': '浏览器不支持',
  'settings.request': '开启桌面通知',
  'notify.approval.title': '需要审批',
  'notify.approval.body': '工具 {toolName} 请求越权执行',
  'notify.question.title': '需要你的回答',
  'notify.question.bodyGeneric': 'Agent 有一个问题需要你回答',
  'notify.turn.title': '轮次完成',
  'notify.turn.body': '第 {turn} 轮已完成',
  'notify.sessionDone.title': '会话完成',
  'notify.other.done.body': '该会话已完成，可以切回查看',
} satisfies Record<string, string>

/** The web-ui-notify namespace key union. */
export type NotifyKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'settings.title': 'Desktop notifications',
  'settings.description': 'Show a system notification when a tool needs approval, asks you a question, or a turn finishes while you are on another tab.',
  'settings.status.granted': 'On',
  'settings.status.denied': 'Blocked by the browser',
  'settings.status.default': 'Not granted',
  'settings.status.unsupported': 'Not supported',
  'settings.request': 'Enable desktop notifications',
  'notify.approval.title': 'Approval required',
  'notify.approval.body': 'Tool {toolName} requests privileged execution',
  'notify.question.title': 'Your answer is needed',
  'notify.question.bodyGeneric': 'The agent has a question for you',
  'notify.turn.title': 'Turn finished',
  'notify.turn.body': 'Turn {turn} completed',
  'notify.sessionDone.title': 'Session finished',
  'notify.other.done.body': 'This session finished — switch over to see the result',
} satisfies Record<NotifyKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'web-ui-notify'
