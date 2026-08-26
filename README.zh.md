# dsh-web-ui-notify — 审批/提问/轮次完成桌面通知插件

[![Release v0.1.4](https://img.shields.io/badge/release-v0.1.4-5B4CF0?style=flat-square)](https://github.com/omdsh-dev/dsh-web-ui-notify/releases/tag/v0.1.4)
[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-0B7285?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%5E20%20%7C%20%3E%3D22-339933?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)
[![DSH profiles](https://img.shields.io/badge/DSH-Web-5B4CF0?style=flat-square)](cordis.patch.yml)

**安装：** `dsh plugin --profile web add github:omdsh-dev/dsh-web-ui-notify`

**DeepSeek Harness Web UI 客户端插件：当工具需要审批、DSH 向你提问、或一轮干完了，而你正在浏览其他标签页时，弹出系统桌面通知——DSH 不等你，你也不用等。**

[English](README.md) | 中文

## 为什么需要它

当你在浏览其他网页时，DSH 需要人工确认（工具审批、提问）或干完了一轮活，而前台标签页的 Web UI 是它唯一提问的地方。只要你在看别处，请求就默默等着。这个插件把这些时刻搬到桌面：原生系统通知出现、标明会话名、点击直接回到对应会话。

## 实现能力

- **当前会话介入时通知**：工具审批和 DSH 提问，通知正文带上下文（审批显示越权原因，提问显示问题原文）
- **后台会话也通知**：没在看的会话需要审批/提问时同样弹通知（正文带上下文，和当前会话一致），整个会话干完也会通知；点一下直接跳到那个会话
- **干完一轮也通知**：当前会话每轮干完都通知，正文是这一轮最终回答的开头（80 字以内），纯工具轮没有最终回答时显示轮次号。不管这轮是正常结束、被中断还是出错，都会通知
- **标题带会话名**：所有通知标题都标明来自哪个会话，如「重构数据库 · 需要审批」
- **点击跳转到对应会话**：点通知不只是跳回 DSH 页面，还会自动打开通知里的那个会话
- 只在你不看这个标签页时通知；页面在前台时 DSH 本来就有提示，不重复打扰
- 同一件事只通知一次，断线重连不会重复响；打开一个有历史记录的会话也不会把旧轮次全刷一遍
- 通知不会几秒后自动消失，等你处理
- 设置 → 通用 里有开关，中英文跟随 DSH 语言

## 安装

插件是 DSH **bundle**（`package.json` 声明 `dsh.bundle` + `dsh.client`），通过标准的 `dsh plugin` 机制安装到 web profile，**无需修改 DSH 源码、无需手写 patch**：

```sh
dsh plugin --profile web add github:omdsh-dev/dsh-web-ui-notify
```

命令内部 = 在 profile 目录执行 `pnpm add <spec>` + 自动把声明了 `dsh.bundle` 的包追加进 `dsh.profile.bundles`。也可以先 clone 再用本地路径安装（开发调试，改完重新构建即生效）：

```sh
dsh plugin --profile web add /path/to/dsh-web-ui-notify
```

仓库里带了构建产物（`lib/`），装完直接可用，不需要另外构建。插件零运行时依赖——浏览器侧那几个 `require`（react、react/jsx-runtime、ui-slots）走 DSH 前端自己的模块表，不经过 npm。

> 旧版 DSH（profile 体系之前）用 `pnpm --filter @deepseek-ai/dsh add` + `config.yaml` 安装；20260806 快照起改为上面的 profile 方式。若你的 DSH 还是旧版，用 README 的历史版本（git 历史里可见）。

安装后**重启 Web UI**（按你当前启动 DSH Web UI 的方式）并刷新浏览器页面，插件即生效。

### 升级

```sh
dsh plugin --profile web update github:omdsh-dev/dsh-web-ui-notify
```

本地路径安装则对替换后的 checkout 重新执行 `add`。用户设置（设置 → 通用 的开关）存在 profile 的 Settings provider 里，升级不丢。

### 卸载

```sh
dsh plugin --profile web remove dsh-web-ui-notify
```

命令内部 = 在 profile 目录执行 `pnpm remove <pkg>` + 自动把它从 `dsh.profile.bundles` 移除。卸载后重启 web 并硬刷新浏览器。

## 使用

装好之后还要授权浏览器通知权限，否则插件是静默的——没授权时浏览器直接禁止弹通知。

1. 打开 **设置 → 通用 → 桌面通知**，点**开启桌面通知**
2. 浏览器弹出询问，选允许，状态变成「已开启」
3. macOS 还要在**系统设置 → 通知**里允许你的浏览器

之后切到别的标签页，遇到审批、提问、或者一轮干完了，就会收到系统通知，点它跳回来处理。

设置行的四种状态：

| 状态 | 含义 |
| --- | --- |
| 已开启 | 正常工作 |
| 未授权 | 点按钮授权 |
| 已被浏览器阻止 | 之前拒绝过，要去浏览器的站点设置里改回允许，点按钮没用 |
| 浏览器不支持 | 当前环境没有通知 API |

## 故障排查

| 症状 | 解决 |
| --- | --- |
| 没有通知出现 | 确认设置 → 通用 的开关是「已开启」、浏览器对 DSH 站点的权限是「允许」、macOS 系统设置 → 通知 里允许了浏览器；然后切到别的标签页——插件只在你不看页面时通知 |
| 重启后通知失效 | 浏览器可能重置了站点权限；重新授权，或如果设置行显示其他状态就重新开启开关 |
| 「已被浏览器阻止」 | 之前拒绝过——去浏览器站点设置改回「允许」，点开启按钮没用 |
| 「浏览器不支持」 | 当前环境没有 Notification API（旧版或特殊浏览器），桌面通知无法工作 |
| 安装后设置里没有该插件 | 插件要重启 Web UI + 硬刷新页面后才出现；用 `dsh --profile web --dump-config | grep web-ui-notify` 确认 bundle 行在 profile 里 |

## 开发与验证

```sh
pnpm install
pnpm run build     # tsc + tsdown -> lib/（已提交）
pnpm test          # vitest：browser-plugin + settings-row 套件
```

`pnpm run build` 把 host + client bundle 生成到 `lib/`，lib 已提交，消费方安装无需构建。测试套件覆盖真实 cordis 上下文上的插件接线（browser-plugin）和 jsdom 里的设置行（settings-row）。改动影响插件可见表面（哪些事件通知、设置行、语言包）时，应在 `tests/` 里同步更新覆盖。

## 社区与关于

- 可复现的 bug、聚焦的功能请求和使用问题，走 [GitHub Issues](https://github.com/omdsh-dev/dsh-web-ui-notify/issues)。
- 提变更前先读 [CONTRIBUTING.md](CONTRIBUTING.md)；安全问题通过 [SECURITY.md](SECURITY.md) 私有上报。
- 版本与兼容性说明见 [CHANGELOG.md](CHANGELOG.md)。

## License

BSD-3-Clause
