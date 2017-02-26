[![Build Status](https://api.travis-ci.org/editor-rs/vscode-rust.svg)](https://travis-ci.org/editor-rs/vscode-rust)
[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/vscode-rust/Lobby)

# Rust for Visual Studio Code (Latest: 0.3.9)

## What is the repository?

The extension is continuation of RustyCode (an extension for Visual Studio Code for Rust language).

RustyCode is no longer maintained and the developer seems to have lost all interest in the extension. Due to no response from the original author, this repository was created which now contains additional features and many bug fixes.

## Extension

- [Documentation](doc/main.md)
- [Contributing](CONTRIBUTING.md)

This extension adds advanced language support for the Rust programming language within VS Code. It features:

- [Rust Language Server](https://github.com/rust-lang-nursery/rls) integration.
- Autocompletion (via `racer` or RLS).
- Go To Definition (via `racer` or RLS).
- Go To Symbol (via `rustsym` or RLS).
- Code formatting (via `rustfmt`).
- Code Snippets.
- Cargo tasks (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and type `cargo` to view them).
- …and a lot of other features. To learn more, see the [documentation](doc/main.md).

On update, please review the [changelog](CHANGELOG.md).

## Installation

1. Firstly, you will need to install [VS Code](https://code.visualstudio.com/) `1.8` or later.

2. Now in VS Code, <kbd>Ctrl</kbd>+<kbd>P</kbd> and type `ext install vscode-rust`.

3. Choose to install the "Rust" extension.

The extension can also be found on the [VS Code marketplace](https://marketplace.visualstudio.com/items?itemName=kalitaalexey.vscode-rust).

## License

[MIT](LICENSE)
