window.__ModuleLoader__.load({
	id: "dsh-web-ui-notify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/Users/zhaowenbo/Downloads/AI项目/dsh-web-ui-notify/src/client/NotificationSettingsRow.module.css.mjs
		const css = ".W6CegG_row{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.W6CegG_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.W6CegG_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.W6CegG_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.W6CegG_status{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:400;line-height:18px}.W6CegG_button{background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:18px;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.W6CegG_button:hover{background:var(--dsw-alias-interactive-bg-hover)}";
		const tagId = "dsh-web-ui-notify/NotificationSettingsRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-web-ui-notify";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var NotificationSettingsRow_module_css_default = {
			"button": "W6CegG_button",
			"desc": "W6CegG_desc",
			"row": "W6CegG_row",
			"rowText": "W6CegG_rowText",
			"status": "W6CegG_status",
			"title": "W6CegG_title"
		};
		//#endregion
		//#region src/client/NotificationSettingsRow.tsx
		/** General Settings row for the desktop-notification permission. */
		/** Read the current browser permission state (safe outside browsers). */
		function permissionState() {
			if (typeof Notification === "undefined") return "unsupported";
			return Notification.permission;
		}
		/** Locale key for a permission state, for the settings row copy. */
		function statusKey(state) {
			switch (state) {
				case "granted": return "settings.status.granted";
				case "denied": return "settings.status.denied";
				case "default": return "settings.status.default";
				case "unsupported": return "settings.status.unsupported";
			}
		}
		/**
		* Render the desktop-notification permission row: current browser state plus
		* a request button (the user-gesture entry point the browser requires before
		* `new Notification` works).
		* @param props - composed Settings slot props.
		* @returns the preference row.
		*/
		function NotificationSettingsRow({ t }) {
			const [state, setState] = (0, react.useState)(permissionState);
			const request = async () => {
				if (typeof Notification === "undefined") return;
				setState(await Notification.requestPermission());
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: NotificationSettingsRow_module_css_default.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: NotificationSettingsRow_module_css_default.rowText,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: NotificationSettingsRow_module_css_default.title,
							children: t("settings.title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: NotificationSettingsRow_module_css_default.desc,
							children: t("settings.description")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: NotificationSettingsRow_module_css_default.status,
							children: t(statusKey(state))
						})
					]
				}), state === "granted" || state === "unsupported" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: NotificationSettingsRow_module_css_default.button,
					onClick: () => {
						request();
					},
					children: t("settings.request")
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** `web-ui-notify` namespace dictionaries. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"settings.title": "桌面通知",
			"settings.description": "当工具需要审批、向你提问、或轮次完成，而你正在浏览其他标签页时，弹出系统通知提醒你。",
			"settings.status.granted": "已开启",
			"settings.status.denied": "已被浏览器阻止",
			"settings.status.default": "未授权",
			"settings.status.unsupported": "浏览器不支持",
			"settings.request": "开启桌面通知",
			"notify.approval.title": "需要审批",
			"notify.approval.body": "工具 {toolName} 请求越权执行",
			"notify.question.title": "需要你的回答",
			"notify.question.bodyGeneric": "Agent 有一个问题需要你回答",
			"notify.plan.title": "计划待审阅",
			"notify.plan.body": "Agent 提交了一份计划，等待你批准或拒绝",
			"notify.turn.title": "轮次完成",
			"notify.turn.body": "第 {turn} 轮已完成",
			"notify.turn.maxTokens.title": "轮次被截断",
			"notify.turn.maxTokens.body": "第 {turn} 轮达到输出上限，回答被截断",
			"notify.turn.error.title": "轮次出错",
			"notify.turn.error.body": "第 {turn} 轮执行失败",
			"notify.turn.aborted.title": "轮次已中止",
			"notify.turn.aborted.body": "第 {turn} 轮被中止",
			"notify.turn.blocked.title": "轮次被拦截",
			"notify.turn.blocked.body": "第 {turn} 轮在启动前被拒绝",
			"notify.turn.interrupted.title": "轮次被中断",
			"notify.turn.interrupted.body": "第 {turn} 轮在崩溃后补记为已结束",
			"notify.sessionDone.title": "会话完成",
			"notify.other.done.body": "该会话已完成，可以切回查看"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"settings.title": "Desktop notifications",
			"settings.description": "Show a system notification when a tool needs approval, asks you a question, or a turn finishes while you are on another tab.",
			"settings.status.granted": "On",
			"settings.status.denied": "Blocked by the browser",
			"settings.status.default": "Not granted",
			"settings.status.unsupported": "Not supported",
			"settings.request": "Enable desktop notifications",
			"notify.approval.title": "Approval required",
			"notify.approval.body": "Tool {toolName} requests privileged execution",
			"notify.question.title": "Your answer is needed",
			"notify.question.bodyGeneric": "The agent has a question for you",
			"notify.plan.title": "Plan needs review",
			"notify.plan.body": "The agent submitted a plan for you to approve or decline",
			"notify.turn.title": "Turn finished",
			"notify.turn.body": "Turn {turn} completed",
			"notify.turn.maxTokens.title": "Turn cut off",
			"notify.turn.maxTokens.body": "Turn {turn} hit the output limit; the answer was cut off",
			"notify.turn.error.title": "Turn failed",
			"notify.turn.error.body": "Turn {turn} failed",
			"notify.turn.aborted.title": "Turn stopped",
			"notify.turn.aborted.body": "Turn {turn} was stopped",
			"notify.turn.blocked.title": "Turn blocked",
			"notify.turn.blocked.body": "Turn {turn} was refused before it ran",
			"notify.turn.interrupted.title": "Turn interrupted",
			"notify.turn.interrupted.body": "Turn {turn} was closed after a crash",
			"notify.sessionDone.title": "Session finished",
			"notify.other.done.body": "This session finished — switch over to see the result"
		};
		/** Dictionary namespace owned by this plugin. */
		const NS = "web-ui-notify";
		//#endregion
		//#region src/client/notify.ts
		/**
		* Whether the browser supports the Notification API and has granted permission.
		* @returns true when `new Notification` may be constructed.
		*/
		function notificationUsable() {
			return typeof Notification !== "undefined" && Notification.permission === "granted";
		}
		/**
		* Attach the click-to-jump behavior shared by every notification this plugin
		* builds: raise the window, jump to the source conversation, and dismiss.
		*/
		function withClickFocus(notification, onOpen) {
			notification.onclick = () => {
				window.focus();
				onOpen();
				notification.close();
			};
			return notification;
		}
		/** Compose a notification title: the session label first, then the kind title. */
		function titled(kindTitle, label) {
			return label === "" ? kindTitle : `${label} · ${kindTitle}`;
		}
		/** The one rendering path every notification kind funnels through. */
		function show(title, body, tag, target) {
			return withClickFocus(new Notification(title, {
				body,
				tag,
				requireInteraction: true
			}), target.onOpen);
		}
		/** Notification-body cap for a plan under review: keep the system notification compact. */
		const PLAN_MAX = 160;
		/** Compact one-line excerpt of a possibly-long body; undefined when absent or blank. */
		function excerptOf(text, max) {
			if (text === void 0) return void 0;
			const trimmed = text.replace(/\s+/gu, " ").trim();
			if (trimmed === "") return void 0;
			return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
		}
		/**
		* Build and show the desktop notification for one pending wait. The caller
		* gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
		* wait key; this function only renders.
		*
		* Three wait kinds reach this renderer: `approval`, `question`, and the
		* `plan-review` intent of a question. A plan review is its own thing — its
		* plan markdown rides the question's `detail` — so it gets its own title and
		* body instead of being reported as an ordinary question.
		* @param wait - the pending approval, question, or plan-review interaction.
		* @param t - bound locale translate for the plugin namespace.
		* @param target - session label + click-to-jump handler + the session-scoped tag
		*   (`${sid}:${wait.key}`), so two sessions' waits can never replace each other.
		* @returns the constructed Notification (tests assert on it).
		*/
		function fireNotification(wait, t, target) {
			const title = titled(wait.kind === "approval" ? t("notify.approval.title") : wait.kind === "plan-review" ? t("notify.plan.title") : t("notify.question.title"), target.label);
			let body;
			if (wait.kind === "approval") body = wait.reason ?? t("notify.approval.body", { toolName: wait.toolName });
			else if (wait.kind === "plan-review") {
				const first = wait.questions[0];
				body = excerptOf(first?.detail, PLAN_MAX) ?? excerptOf(first?.question, PLAN_MAX) ?? t("notify.plan.body");
			} else body = excerptOf(wait.questions[0]?.question, PLAN_MAX) ?? t("notify.question.bodyGeneric");
			return show(title, body, target.tag, target);
		}
		/** Title/body copy per non-completed outcome (completed keeps the excerpt copy). */
		const TURN_OUTCOME_COPY = {
			"max-tokens": {
				title: "notify.turn.maxTokens.title",
				body: "notify.turn.maxTokens.body"
			},
			error: {
				title: "notify.turn.error.title",
				body: "notify.turn.error.body"
			},
			aborted: {
				title: "notify.turn.aborted.title",
				body: "notify.turn.aborted.body"
			},
			blocked: {
				title: "notify.turn.blocked.title",
				body: "notify.turn.blocked.body"
			},
			interrupted: {
				title: "notify.turn.interrupted.title",
				body: "notify.turn.interrupted.body"
			}
		};
		/**
		* Build and show the desktop notification for a finished turn. A turn that
		* produced no final assistant text is normal — a concluding tool
		* (`concludesTurn`), a structured-output subagent, a PTC script that ends the
		* loop — so only the outcome decides the copy, never the absence of text. The
		* caller gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
		* turn; this function only renders.
		* @param turn - the finished turn number.
		* @param summary - optional excerpt of the turn's final assistant text; when
		*   absent (a tool-only turn) a completed turn falls back to the turn copy.
		* @param facts - why the turn ended (see {@link TurnEndFacts}).
		* @param t - bound locale translate for the plugin namespace.
		* @param target - session label + click-to-jump handler + the session-scoped tag
		*   (`${sid}:turn:${turn}`), so two sessions' turn numbers cannot collide.
		* @returns the constructed Notification (tests assert on it).
		*/
		function fireTurnNotification(turn, summary, facts, t, target) {
			if (facts.outcome !== "completed") {
				const copy = TURN_OUTCOME_COPY[facts.outcome];
				const body = facts.detail !== void 0 && facts.detail !== "" ? facts.detail : t(copy.body, { turn: String(turn) });
				return show(titled(t(copy.title), target.label), body, target.tag, target);
			}
			const body = summary !== void 0 && summary !== "" ? summary : t("notify.turn.body", { turn: String(turn) });
			return show(titled(t("notify.turn.title"), target.label), body, target.tag, target);
		}
		/**
		* Build and show the desktop notification for a whole background session
		* finishing ("done" reminder). The caller gates on {@link hiddenNow} /
		* {@link notificationUsable} and dedupes per session; this function only
		* renders.
		* @param t - bound locale translate for the plugin namespace.
		* @param target - session label + click-to-jump handler + a unique tag so the
		*   browser never replaces one session's notification with another's.
		* @returns the constructed Notification (tests assert on it).
		*/
		function fireSessionDoneNotification(t, target) {
			return show(titled(t("notify.sessionDone.title"), target.label), t("notify.other.done.body"), target.tag, target);
		}
		//#endregion
		//#region src/client/pages.ts
		/** Heartbeat period: peers older than the TTL are considered gone. */
		const HEARTBEAT_MS = 4e3;
		/** A peer that missed this much is treated as closed (frozen tabs included). */
		const PEER_TTL_MS = 12e3;
		/** How long a non-winner waits for the winner's "shown" broadcast. */
		const FALLBACK_MS = 600;
		/** Persisted "shown" keys older than this are re-announced rather than lost. */
		const MEMORY_TTL_MS = 1440 * 60 * 1e3;
		/** Persisted-memory key prefix, namespaced to this plugin. */
		const MEMORY_PREFIX = "dsh-web-ui-notify:shown:";
		/** A random page id, falling back when `crypto.randomUUID` is unavailable. */
		function randomPageId() {
			return globalThis.crypto?.randomUUID?.() ?? `page-${Math.random().toString(36).slice(2)}`;
		}
		/** The browser default bus: a BroadcastChannel, or nothing when unsupported. */
		function browserBus(name) {
			const Channel = globalThis.BroadcastChannel;
			if (Channel === void 0) return void 0;
			const channel = new Channel(name);
			return {
				postMessage: (message) => {
					channel.postMessage(message);
				},
				onMessage: (handler) => {
					channel.onmessage = (event) => handler(event.data);
				},
				close: () => {
					channel.close();
				}
			};
		}
		/** The browser default memory: localStorage, or nothing when unsupported. */
		function browserMemory() {
			try {
				const storage = globalThis.localStorage;
				if (storage === void 0) return void 0;
				return {
					read: (key) => storage.getItem(key),
					write: (key, value) => {
						storage.setItem(key, value);
					}
				};
			} catch {
				return;
			}
		}
		/**
		* Create one page's coordinator.
		* @param options - injectable seams; production passes nothing.
		* @returns the coordinator for this page.
		*/
		function createPageCoordination(options = {}) {
			const pageId = options.pageId ?? randomPageId();
			const bus = options.bus ?? browserBus("dsh-web-ui-notify/pages");
			const memory = options.memory ?? browserMemory();
			const now = options.now ?? (() => Date.now());
			const peers = /* @__PURE__ */ new Map();
			const shown = /* @__PURE__ */ new Set();
			const fallbacks = /* @__PURE__ */ new Map();
			let view = {
				visible: true,
				sessionId: void 0,
				granted: false
			};
			const publish = () => {
				bus?.postMessage({
					kind: "view",
					id: pageId,
					at: now(),
					...view
				});
			};
			const markShown = (key) => {
				shown.add(key);
				memory?.write(`${MEMORY_PREFIX}${key}`, JSON.stringify({ at: now() }));
				bus?.postMessage({
					kind: "shown",
					id: pageId,
					key,
					at: now()
				});
			};
			const shownBefore = (key) => {
				if (shown.has(key)) return true;
				const raw = memory?.read(`${MEMORY_PREFIX}${key}`);
				if (raw === null || raw === void 0) return false;
				try {
					const parsed = JSON.parse(raw);
					return typeof parsed.at === "number" && now() - parsed.at < MEMORY_TTL_MS;
				} catch {
					return false;
				}
			};
			const live = () => {
				const cutoff = now() - PEER_TTL_MS;
				for (const [id, peer] of peers) if (peer.at < cutoff) peers.delete(id);
				return [...peers.values()];
			};
			const cancelFallback = (key) => {
				fallbacks.get(key)?.();
				fallbacks.delete(key);
			};
			bus?.onMessage((data) => {
				if (typeof data !== "object" || data === null) return;
				const message = data;
				if (message.id === void 0 || message.id === pageId) return;
				switch (message.kind) {
					case "view":
						peers.set(message.id, {
							id: message.id,
							at: message.at ?? now(),
							visible: message.visible === true,
							sessionId: message.sessionId,
							granted: message.granted === true
						});
						break;
					case "shown":
						if (message.key !== void 0) {
							shown.add(message.key);
							cancelFallback(message.key);
						}
						break;
					case "bye":
						peers.delete(message.id);
						break;
					default: break;
				}
			});
			const heartbeat = setInterval(publish, HEARTBEAT_MS);
			heartbeat.unref?.();
			return {
				pageId,
				announce: (next) => {
					view = next;
					publish();
				},
				watched: (sessionId) => {
					if (view.visible && view.sessionId === sessionId) return true;
					return live().some((peer) => peer.visible && peer.sessionId === sessionId);
				},
				elect: (key, sessionId, scope, fire) => {
					if (shownBefore(key)) return false;
					if (view.visible && view.sessionId === sessionId) return false;
					if (live().some((peer) => peer.visible && peer.sessionId === sessionId)) return false;
					const winner = [selfState(), ...live()].filter((candidate) => candidate.granted).filter((candidate) => scope === "any-page" || candidate.sessionId === sessionId).sort((left, right) => Number(right.visible) - Number(left.visible) || (left.id < right.id ? -1 : 1))[0];
					if (winner === void 0) return false;
					if (winner.id === pageId) {
						markShown(key);
						fire();
						return true;
					}
					const timer = setTimeout(() => {
						fallbacks.delete(key);
						if (shown.has(key)) return;
						markShown(key);
						fire();
					}, FALLBACK_MS);
					timer.unref?.();
					fallbacks.set(key, () => {
						clearTimeout(timer);
					});
					return false;
				},
				forget: (key) => {
					shown.delete(key);
					memory?.write(`${MEMORY_PREFIX}${key}`, "");
				},
				close: () => {
					clearInterval(heartbeat);
					bus?.postMessage({
						kind: "bye",
						id: pageId,
						at: now()
					});
					for (const cancel of fallbacks.values()) cancel();
					fallbacks.clear();
					bus?.close();
				}
			};
			/** This page as an election candidate. */
			function selfState() {
				return {
					id: pageId,
					at: now(),
					...view
				};
			}
		}
		//#endregion
		//#region src/client/index.ts
		/** Notification-body excerpt cap: keep the system notification compact. */
		const SUMMARY_MAX = 80;
		/** Session-label cap in notification titles: keep the title bar compact. */
		const SESSION_LABEL_MAX = 40;
		/**
		* The Session shown in the main view — the one whose turns this client watches
		* and whose own completion is reported by the turn layer rather than the
		* "you were elsewhere" reminder.
		*
		* dsh 0.1.7 dropped `SessionListState.current`, so this mirrors the Workspace
		* browser's rule: the row the main view retains is the selected one.
		* @param list - the session-list snapshot.
		* @returns the main-view session id, or undefined while nothing is shown.
		*/
		function mainSessionId(list) {
			return Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
		}
		/**
		* Extract a compact excerpt of one turn's final assistant text for the
		* notification body: the LAST assistant node of that turn, text blocks joined
		* and truncated. A tool-only turn (no final text) yields undefined, so the
		* caller falls back to the turn-number copy.
		* @param nodes - the conversation nodes in event order.
		* @param turn - the finished turn number.
		* @returns the excerpt, or undefined when the turn produced no final text.
		*/
		function turnSummaryOf(nodes, turn) {
			let text = "";
			for (const node of nodes) {
				if (node.kind !== "assistant" || node.turn !== turn) continue;
				let joined = "";
				for (const block of node.blocks) if (block.kind === "text") joined += block.text;
				if (joined !== "") text = joined;
			}
			if (text === "") return void 0;
			const trimmed = text.replace(/\s+/gu, " ").trim();
			return trimmed.length > SUMMARY_MAX ? `${trimmed.slice(0, SUMMARY_MAX)}…` : trimmed;
		}
		/**
		* Translate one harness turn-end reason into the facts a notification reports,
		* or undefined when nothing should be announced.
		*
		* A turn that ends without a final assistant answer is not an error: a
		* concluding tool (`concludesTurn`), a structured-output subagent, or a PTC
		* script can close a turn legitimately — and a stop or a failure closes one
		* without any answer at all. Only the reason distinguishes them, so the
		* timeline's own `turn/end` event decides the copy.
		* @param reason - the turn's `TurnEndReason`, absent while the end is not loaded.
		* @returns the facts to render, or undefined to stay silent for this turn.
		*/
		function turnFactsOf(reason) {
			if (reason === void 0) return void 0;
			switch (reason.kind) {
				case "completed": return { outcome: "completed" };
				case "max-tokens": return { outcome: "max-tokens" };
				case "blocked": return { outcome: "blocked" };
				case "interrupted": return { outcome: "interrupted" };
				case "error": return {
					outcome: "error",
					detail: reason.error.message
				};
				case "aborted": {
					const cause = reason.reason;
					return cause.kind === "hook" && cause.reason !== "" ? {
						outcome: "aborted",
						detail: cause.reason
					} : { outcome: "aborted" };
				}
				case "forked": return;
				default: return { outcome: "completed" };
			}
		}
		/** Required services: the settings slots registry, session domain, locale, and the
		* UI session/conversation faces that carry the unified session status and the
		* chat snapshot sources. */
		const inject = [
			"slots",
			"sessions",
			"locale",
			"uiConversation",
			"uiSession",
			"uiWorkspace"
		];
		/**
		* Client plugin body: register the `web-ui-notify` dictionaries, subscribe to
		* the unified session-status source (background waits + completions) and the
		* current session's chat snapshot (turn completions), and register the
		* settings row.
		* @param ctx - client root context.
		* @param options - test seam: an injected cross-page coordinator.
		*/
		function apply(ctx, options) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-notify: dictionaries");
			const t = ctx.locale.bind(NS);
			const sessions = ctx.sessions;
			/**
			* Cross-page coordination. Every tab runs its own copy of this plugin, so the
			* election and the "already shown" memory live behind this seam: one event,
			* one notification, whichever tab happens to be in front.
			*/
			const pages = options?.pages ?? createPageCoordination();
			/**
			* Announce this page's view: tab visibility, the session its main view shows,
			* and whether notifications are permitted here. A page announcing a visible
			* main-view session suppresses that session's notifications everywhere.
			*/
			const syncView = () => pages.announce({
				visible: typeof document !== "undefined" && document.visibilityState === "visible",
				sessionId: mainSessionId(sessions.list.getSnapshot()),
				granted: notificationUsable()
			});
			/**
			* One-shot degradation report. A scan must never surface as a subscriber
			* error, but a source that silently stops existing is exactly how a harness
			* contract change becomes invisible: warn once per source, naming it.
			*/
			const degraded = /* @__PURE__ */ new Set();
			const degrade = (source, error) => {
				if (degraded.has(source)) return;
				degraded.add(source);
				console.warn(`[web-ui-notify] ${source} is unavailable — notifications from that source are disabled. This usually means the harness UI contract changed; re-check this plugin against the current dsh version.`, error);
			};
			/**
			* Pending-interaction keys already notified, scoped by session
			* (`${sid}:${wait.key}`, stable across replay, so reconnect and mux-open
			* replay stay silent).
			*/
			const notified = /* @__PURE__ */ new Set();
			/** Sessions whose "finished while you were away" reminder was already shown. */
			const completionNotified = /* @__PURE__ */ new Set();
			/** Completed turn numbers already seen per session (baseline absorbed on first scan). */
			const seenTurns = /* @__PURE__ */ new Map();
			let unsubSession;
			let watched;
			/** Session display label for notification titles (fallback: the raw id). */
			const labelOf = (sid) => {
				const label = sessions.list.getSnapshot().byId[sid]?.displayTitle ?? sid;
				return label.length > SESSION_LABEL_MAX ? `${label.slice(0, SESSION_LABEL_MAX)}…` : label;
			};
			/** Click-to-jump handler for one notification: focus, then open its session. */
			const openOf = (sid) => () => {
				if (sessions.list.getSnapshot().byId[sid] === void 0) return;
				try {
					ctx.uiWorkspace.openSession(sid);
				} catch (error) {
					degrade("session navigation (uiWorkspace.openSession)", error);
				}
			};
			/** Scan the current session's chat snapshot; notify newly finished turns.
			*  alpha2 moved turnEnds/nodes off the session snapshot onto the Chat view's
			*  legacy projection, so this reads the chat target. A chat view that is not
			*  materialized yet yields undefined and is simply skipped. The turn's
			*  `turn/end` reason comes from the same snapshot's timeline, so a stopped or
			*  failed turn is not reported as a finished one.
			*/
			const scan = () => {
				try {
					const current = mainSessionId(sessions.list.getSnapshot());
					if (current === void 0) return;
					const snapshot = ctx.uiConversation.binding(current).target("chat").getSnapshot();
					if (snapshot === void 0) return;
					if (snapshot.legacy === void 0) {
						degrade("chat legacy slice (ChatSnapshot.legacy)", /* @__PURE__ */ new Error("ChatSnapshot.legacy is missing"));
						return;
					}
					let turns = seenTurns.get(current);
					if (turns === void 0) {
						turns = new Set(snapshot.legacy.turnEnds.keys());
						seenTurns.set(current, turns);
						return;
					}
					for (const turn of snapshot.legacy.turnEnds.keys()) {
						if (turns.has(turn)) continue;
						turns.add(turn);
						const facts = turnFactsOf(snapshot.timeline?.turns.get(turn)?.end?.data.reason);
						if (facts === void 0) continue;
						const tag = `${current}:turn:${turn}`;
						pages.elect(tag, current, "showing-session", () => {
							fireTurnNotification(turn, turnSummaryOf(snapshot.legacy.nodes, turn), facts, t, {
								label: labelOf(current),
								onOpen: openOf(current),
								tag
							});
						});
					}
				} catch (error) {
					degrade("chat turn source (uiConversation.chat.legacy)", error);
				}
			};
			/**
			* Scan the unified session-status map — the signal that covers sessions you
			* are NOT looking at, which is the point of this plugin:
			*
			* - `pendingInteraction` newly present on ANY session (approval, question or
			*   plan review, current or background) notifies once per interaction key.
			* - `completionUnread` is dsh's own "a session stopped outside the main view
			*   and you have not acknowledged it" flag; it notifies once per session and
			*   re-arms when the flag drops.
			*
			* The status map needs its OWN subscription: it moves independently of the
			* session list, so reading it from the list subscription left approvals and
			* completions unnotified until some unrelated list mutation happened by.
			*/
			const scanStatus = () => {
				try {
					const statuses = ctx.uiSession.sessionStatus.getSnapshot();
					const current = mainSessionId(sessions.list.getSnapshot());
					for (const [sid, status] of statuses) {
						const wait = status.pendingInteraction;
						if (wait !== void 0) {
							const key = `${sid}:${wait.key}`;
							if (!notified.has(key)) {
								notified.add(key);
								pages.elect(key, sid, "any-page", () => {
									fireNotification(wait, t, {
										label: labelOf(sid),
										onOpen: openOf(sid),
										tag: key
									});
								});
							}
						}
						if (status.completionUnread === true && sid !== current) {
							if (!completionNotified.has(sid)) {
								completionNotified.add(sid);
								pages.elect(`${sid}:done`, sid, "any-page", () => {
									fireSessionDoneNotification(t, {
										label: labelOf(sid),
										onOpen: openOf(sid),
										tag: `${sid}:done`
									});
								});
							}
						} else if (status.completionUnread !== true) {
							completionNotified.delete(sid);
							pages.forget(`${sid}:done`);
						}
					}
					for (const sid of completionNotified) if (!statuses.has(sid)) completionNotified.delete(sid);
				} catch (error) {
					degrade("session-status source (uiSession.sessionStatus)", error);
				}
			};
			/** Re-subscribe to the current session's chat snapshot when `current` moves. */
			const watchCurrent = () => {
				const current = mainSessionId(sessions.list.getSnapshot());
				if (current === watched) return;
				unsubSession?.();
				unsubSession = void 0;
				watched = current;
				if (current === void 0) return;
				try {
					unsubSession = ctx.uiConversation.binding(current).target("chat").subscribe(scan);
				} catch (error) {
					unsubSession = void 0;
					degrade("chat snapshot subscription (uiConversation.chat)", error);
				}
				scan();
			};
			const unsubList = sessions.list.subscribe(() => {
				watchCurrent();
				syncView();
			});
			const unsubStatus = ctx.uiSession.sessionStatus.subscribe(scanStatus);
			const onVisibilityChange = () => syncView();
			if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
			syncView();
			watchCurrent();
			scanStatus();
			ctx.effect(() => () => {
				unsubList();
				unsubStatus();
				unsubSession?.();
				if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
				pages.close();
			}, "ui-notify: session subscription");
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "web-ui-notify",
				order: 30,
				locale: NS
			}, NotificationSettingsRow));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.turnSummaryOf = turnSummaryOf;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map