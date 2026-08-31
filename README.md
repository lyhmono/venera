# venera (lyhmono fork)

> 本项目是 [venera-app/venera](https://github.com/venera-app/venera) 的复刻维护分支。
> 原仓库已停止维护（原开发者精力有限，欢迎 fork），这里承接后续的修复与更新。
> 由于原组织的 git 依赖仓库可能失效，构建依赖已逐步迁移到个人 fork（见 `pubspec.yaml`）。

A comic reader that support reading local and network comics.

## Features
- Read local comics
- Use javascript to create comic sources
- Read comics from network sources
- Manage favorite comics
- Download comics
- View comments, tags, and other information of comics if the source supports
- Login to comment, rate, and other operations if the source supports

## Build from source
1. Clone the repository
2. Install flutter, see [flutter.dev](https://flutter.dev/docs/get-started/install)
3. Install rust, see [rustup.rs](https://rustup.rs/)
4. Build for your platform: e.g. `flutter build apk`

## Create a new comic source
See [Comic Source](doc/comic_source.md)

## Thanks

### Tags Translation
[EhTagTranslation](https://github.com/EhTagTranslation/Database)

The Chinese translation of the manga tags is from this project.

## Headless Mode
See [Headless Doc](doc/headless_doc.md)
