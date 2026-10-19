# DeepSeek Harness (Civilization Fork)

English | [中文](README.zh.md)

> **Unofficial Repository Maintenance Statement**: This repository is an **unofficial community fork of DeepSeek Harness**, maintained by the [Civilization](https://github.com/civilization-os) organization. Official upstream repository is [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (Copyright (c) DeepSeek-AI).

- **Fork Repository**: [civilization-os/deepseek-harness](https://github.com/civilization-os/deepseek-harness).
- **Baseline Version**: Fully aligned and synchronized with official upstream release **`0.2.1-rc.2`** (Git Tag: `dsh-v0.2.1-rc.2`).
- **Published npm Package**: Distributed under the standalone package **[`@civilization/dsh`](https://www.npmjs.com/package/@civilization/dsh)** to avoid name collisions with official releases.
- **Versioning Convention**: Follows `0.2.1-rc.2-civilization.x.y.z`, maintaining full compatibility with upstream while sequencing independent patches.
- **Key Improvements**:
  - **File Upload Path Normalization**: Resolved path normalization issues on Windows and cross-platform environments causing file upload failures (PR / Issue #1).
  - **Simplified Single-Package Release**: Streamlined publishing pipeline where installing `@civilization/dsh` provides the full CLI and Web runtime directly.
  - **Transparent Branding and About Section**: Client Web settings panel displays Civilization build badge, version details, and GitHub repository links; CLI help displays package provenance for clear distinction from upstream builds.

---

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Official Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

To run using our package from npm:

```sh
# Quick launch Web UI
npx @civilization/dsh web

# Or install globally
npm install -g @civilization/dsh
dsh web
```

> Note: To run the official upstream release, use `npx @deepseek-ai/dsh web`.

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from this repository checkout:

```sh
git clone https://github.com/civilization-os/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/civilization-os/deepseek-harness/discussions) or Issues.
- Official upstream feedback and discussions: [deepseek-ai/deepseek-harness/discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/4MrtZUhpxg">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

`pnpm run dev:web` builds, serves, and rebuilds client bundles on source edits in one terminal, and `make help` lists the matching Make targets for Web and Desktop; the guide's application commands section owns the full table.

For agents, follow [AGENTS.md](AGENTS.md).

## Citation

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
