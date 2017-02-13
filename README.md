[![Build Status](https://api.travis-ci.org/KalitaAlexey/vscode-rust.svg)](https://travis-ci.org/KalitaAlexey/vscode-rust)
[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/vscode-rust/Lobby)

[The extension on VSCode marketplace](https://marketplace.visualstudio.com/items?itemName=kalitaalexey.vscode-rust)

# Rust for Visual Studio Code (Latest: 0.3.6)

## Why this fork

The maintainer of RustyCode doesn't answer.

The repo contains a lot of bug fixes and new features.

## Extension

On update please look at the change log.

[Changelog](CHANGELOG.md)

[Documentation](doc/main.md)

[Contributing](CONTRIBUTING.md)

[Roadmap](ROADMAP.md)

This extension adds advanced language support for the Rust language to VS Code, including:

- Autocompletion (using `racer` or `Rust Language Server`)
- Go To Definition (using `Rust Language Server` or `Rust Language Server`)
- Go To Symbol (using `rustsym` or `Rust Language Server`)
- Format (using `rustfmt`)
- Cargo tasks (Open the Command Palette and they will be there)
- Snippets
- And a lot of other features, to read about them, read the [documentation](doc/main.md).

## Installation

First, you will need to install Visual Studio Code `1.8` or newer.

In the command palette (`cmd-shift-p`) select `Install Extension` and choose `Rust`.

## License

[MIT](LICENSE)
