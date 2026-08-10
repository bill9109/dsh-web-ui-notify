# dsh-web-ui-notify — 审批/提问/轮次完成桌面通知插件

DeepSeek Harness Web UI 客户端插件：当工具需要审批、DSH 向你提问、或一轮干完了，而你正在浏览其他标签页时，弹出系统桌面通知，避免 DSH 白等、也避免你白等。

发布于 [dsh-external](https://github.com/dsh-external) 组织 · 许可证 BSD-3-Clause

> 本组织为 DSH 内测社区仓库，官方不保证公开发布后该组织仍然存在，请自行保留副本。

## 实现能力

在浏览其他网页过程中，DSH 需要人工确认权限、或者干完了一轮活，会通过系统通知提醒你。

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

需要 DSH 源码环境（`scripts/install.sh` 装出来的 checkout，默认在 `~/.dsh/source/current`）。下面把它记作 `$DSH`。

插件通过新版 DSH 的 profile 体系安装：插件装进 `~/.dsh/profiles/web/`（web profile 自己的 pnpm 工作区），启用靠 profile 的 patch 层（`~/.dsh/profiles/web/cordis.patch.yml`），**不用改 DSH 仓库里的任何文件**。

### 1. 装进去

```sh
cd $DSH
./bin/dsh plugin --profile web add "github:dsh-external/dsh-web-ui-notify"
```

也可以先 clone 再用本地路径装：`./bin/dsh plugin --profile web add "file:/path/to/dsh-web-ui-notify"`。首次运行会自动初始化 web profile（`dsh.plugin` 命令会建好 profile 目录和 pnpm 工作区）。

仓库里带了构建产物（`lib/`），装完直接可用，不需要另外构建。插件零运行时依赖——浏览器侧那三个 `require`（react、react/jsx-runtime、ui-slots）走 DSH 前端自己的模块表，不经过 npm。

> 旧版 DSH（profile 体系之前）用 `pnpm --filter @deepseek-ai/dsh add` + `~/.dsh/config.yaml` 安装；20260806 快照起改为上面的 profile 方式。若你的 DSH 还是旧版，用 README 的历史版本（git 历史里可见）。

### 2. 启用

编辑 `~/.dsh/profiles/web/cordis.patch.yml`，加这几行：

```yaml
- insert:
    - id: ui-notify
      name: '@dsh-external/dsh-web-ui-notify'
```

### 3. 重启 Web UI

```sh
cd $DSH && ./bin/dsh web
```

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


## 卸载

```sh
cd $DSH && ./bin/dsh plugin --profile web remove @dsh-external/dsh-web-ui-notify
```

再把 `~/.dsh/profiles/web/cordis.patch.yml` 里那几行删掉，重启 Web UI。
