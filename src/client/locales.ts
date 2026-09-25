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
  'notify.plan.title': '计划待审阅',
  'notify.plan.body': 'Agent 提交了一份计划，等待你批准或拒绝',
  'notify.turn.title': '轮次完成',
  'notify.turn.body': '第 {turn} 轮已完成',
  'notify.turn.maxTokens.title': '轮次被截断',
  'notify.turn.maxTokens.body': '第 {turn} 轮达到输出上限，回答被截断',
  'notify.turn.error.title': '轮次出错',
  'notify.turn.error.body': '第 {turn} 轮执行失败',
  'notify.turn.aborted.title': '轮次已中止',
  'notify.turn.aborted.body': '第 {turn} 轮被中止',
  'notify.turn.blocked.title': '轮次被拦截',
  'notify.turn.blocked.body': '第 {turn} 轮在启动前被拒绝',
  'notify.turn.interrupted.title': '轮次被中断',
  'notify.turn.interrupted.body': '第 {turn} 轮在崩溃后补记为已结束',
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
  'notify.plan.title': 'Plan needs review',
  'notify.plan.body': 'The agent submitted a plan for you to approve or decline',
  'notify.turn.title': 'Turn finished',
  'notify.turn.body': 'Turn {turn} completed',
  'notify.turn.maxTokens.title': 'Turn cut off',
  'notify.turn.maxTokens.body': 'Turn {turn} hit the output limit; the answer was cut off',
  'notify.turn.error.title': 'Turn failed',
  'notify.turn.error.body': 'Turn {turn} failed',
  'notify.turn.aborted.title': 'Turn stopped',
  'notify.turn.aborted.body': 'Turn {turn} was stopped',
  'notify.turn.blocked.title': 'Turn blocked',
  'notify.turn.blocked.body': 'Turn {turn} was refused before it ran',
  'notify.turn.interrupted.title': 'Turn interrupted',
  'notify.turn.interrupted.body': 'Turn {turn} was closed after a crash',
  'notify.sessionDone.title': 'Session finished',
  'notify.other.done.body': 'This session finished — switch over to see the result',
} satisfies Record<NotifyKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'web-ui-notify'
