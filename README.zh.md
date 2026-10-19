# DeepSeek Harness (Civilization 构建版)

[English](README.md) | 中文

> **非官方仓库维护说明**：本项目为 **DeepSeek Harness 的非官方社区维护分支（Unofficial Community Fork）**，由 [Civilization](https://github.com/civilization-os) 组织维护。官方上游仓库为 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（版权归 DeepSeek-AI 所有）。

- **本分支仓库**：[civilization-os/deepseek-harness](https://github.com/civilization-os/deepseek-harness)。
- **基线对齐**：完全同步对齐上游官方最新发布版本 **`0.2.1-rc.2`**（Git Tag: `dsh-v0.2.1-rc.2`）。
- **独立发布包**：为避免与官方发布包冲突，本分支使用独立的 npm 主包 **[`@civilization/dsh`](https://www.npmjs.com/package/@civilization/dsh)** 进行分发。
- **版本规则**：遵循 `0.2.1-rc.2-civilization.x.y.z` 规则，紧密跟随官方主版本号的同时，顺延递增本分支的专属发布版本。
- **主要优化与修复**：
  - **文件上传路径修复**：修复了在 Windows 与跨平台环境下，拖拽或上传附件时因路径规范化处理导致的解析异常问题（参考 PR / Issue #1）。
  - **单主包极简发布机制**：重构并精简了发布与安装流程，用户仅需全局安装 `@civilization/dsh` 主包即可开箱使用完整的 CLI 与 Web 界面。
  - **清晰的品牌与关于界面**：在客户端 Web 设置面板中添加关于界面、Civilization 构建版标识及 GitHub 仓库链接；CLI 帮助信息明确标注归属，方便区分官方原版与本构建版。

---

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

官方文档：[https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## 开发者预览

DeepSeek Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

推荐使用本分支发布的 npm 包进行体验：

```sh
# 免安装快速启动 Web UI
npx @civilization/dsh web

# 或全局安装后启动
npm install -g @civilization/dsh
dsh web
```

> 注：若需要使用官方原生版本，可执行 `npx @deepseek-ai/dsh web`。

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从本分支仓库源码运行：

```sh
git clone https://github.com/civilization-os/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 会准备仓库产物。`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/civilization-os/deepseek-harness/discussions) 或 Issue 提交反馈与 bug 报告。
- 官方社区支持与 Discussions 请参见 [deepseek-ai/deepseek-harness/discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 官方企微群！扫描下方二维码填写入群问卷，小助手会定期发送入群邀请。

<table>
  <thead>
    <tr>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

`pnpm run dev:web` 会在一个终端里完成构建、启动，并在源码修改时重建 client bundle；`make help` 列出 Web 与 Desktop 对应的 Make target。完整表格见开发指南的「应用命令」一节。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 引用

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
