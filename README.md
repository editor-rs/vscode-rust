[![Build Status](https://api.travis-ci.org/KalitaAlexey/vscode-rust.svg)](https://travis-ci.org/KalitaAlexey/vscode-rust)
[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/vscode-rust/Lobby)

# Rust for Visual Studio Code (Latest: 0.2.3)

**0.2.0** introduces breaking changes.

On update please look at the change log.

[Changelog](CHANGELOG.md)

[Contributing](CONTRIBUTING.md)

[Roadmap](ROADMAP.md)

This extension adds advanced language support for the Rust language to VS Code, including:

- Autocompletion (using `racer`)
- Go To Definition (using `racer`)
- Go To Symbol (using `rustsym`)
- Format (using `rustfmt`)
- Linter. Linting can be done via:
	- `check`. This is the default. Runs rust compiler but skips codegen pass.
	- `clippy` if `cargo-clippy` is installed
	- `build`
- Cargo tasks (Open Command Pallete and they will be there)
- Snippets


### IDE Features
![IDE](images/ide_features.png)

## Using

First, you will need to install Visual Studio Code `1.8` or newer. In the command pallete (`cmd-shift-p`) select `Install Extension` and choose `Rust`.

This extension uses the following applications:

* racer
* rustsym
* rustfmt

All this applications can be installed by youself and by VSCode.

In order to install them in VSCode, Open any *.rs file and click on the button "Rust Tools Missing" at the right bottom corner.

**racer** uses source files to provide autocompletion. Install them to your computer to use **racer**.

### Options

The following Visual Studio Code settings are available for the Rust extension. These can be set in user preferences or workspace settings (`.vscode/settings.json`)

```javascript
{
	"rust.racerPath": null, // Specifies path to Racer binary if it's not in PATH
	"rust.rustLangSrcPath": null, // Specifies path to /src directory of local copy of Rust sources
	"rust.rustfmtPath": null, // Specifies path to Rustfmt binary if it's not in PATH
	"rust.rustsymPath": null, // Specifies path to Rustsym binary if it's not in PATH
	"rust.cargoPath": null, // Specifies path to Cargo binary if it's not in PATH
	"rust.cargoHomePath": null, // Path to Cargo home directory, mostly needed for racer. Needed only if using custom rust installation.
	"rust.cargoEnv": null, // Specifies custom variables to set when running cargo. Useful for crates which use env vars in their build.rs (like openssl-sys).
	"rust.formatOnSave": false, // Turn on/off autoformatting file on save (EXPERIMENTAL)
	"rust.checkOnSave": false, // Turn on/off `cargo check` project on save (EXPERIMENTAL)
	"rust.checkWith": "build", // Specifies the linter to use. (EXPERIMENTAL)
	"rust.useJsonErrors": false, // Enable the use of JSON errors (requires Rust 1.7+). Note: This is an unstable feature of Rust and is still in the process of being stablised
	"rust.useNewErrorFormat": false, // "Use the new Rust error format (RUST_NEW_ERROR_FORMAT=true). Note: This flag is mutually exclusive with `useJsonErrors`.
}
```

## Building and Debugging the Extension

[Repository](https://github.com/KalitaAlexey/vscode-rust)

You can set up a development enviroment for debugging the extension during extension development.

First make sure you do not have the extension installed in `~/.vscode/extensions`. Then clone the repo somewhere else on your machine, run `npm install` and open a development instance of Code.

```bash
rm -rf ~/.vscode/extensions/vscode-rust
cd ~
git clone https://github.com/KalitaAlexey/vscode-rust
cd vscode-rust
npm install
npm run-script compile
code .
```

You can now go to the Debug viewlet and select `Launch Extension` then hit run (`F5`).
If you make edits in the extension `.ts` files, just reload (`cmd-r`) the `[Extension Development Host]` instance of Code to load in the new extension code.  The debugging instance will automatically reattach.

## License
[MIT](LICENSE)
