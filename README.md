[![Build Status](https://api.travis-ci.org/KalitaAlexey/vscode-rust.svg)](https://travis-ci.org/KalitaAlexey/vscode-rust)
[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://github.com/KalitaAlexey/vscode-rust)

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
	- `check-lib`. As above, but is limited only to library if project has library + multiple binaries
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
	// Specifies path to Racer binary if it's not in PATH
	"rust.racerPath": null,
	// Specifies path to Rustfmt binary if it's not in PATH
	"rust.rustfmtPath": null,
	// Specifies path to Rustsym binary if it's not in PATH
	"rust.rustsymPath": null,
	// Specifies path to /src directory of local copy of Rust sources
	"rust.rustLangSrcPath": null,
	// Automatically show output panel when starting any cargo task
	"rust.showOutput": true,
	// Specifies path to Cargo binary if it's not in PATH
	"rust.cargoPath": null,
	// Specifies path to home directory of Cargo. Mostly needed for working with custom installations of Rust via rustup or multirust.
	"rust.cargoHomePath": null,
	// Specifies custom variables to set when running cargo. Useful for crates which use env vars in their build.rs (like openssl-sys).
	"rust.cargoEnv": null,
	// Turn on/off autoformatting file on save
	"rust.formatOnSave": false,
	//
	"rust.actionOnSave": null,
	// Arguments which is passed to cargo build
	"rust.buildArgs": [],
	// Arguments which is passed to cargo check
	"rust.checkArgs": [],
	// Arguments which is passed to cargo clippy
	"rust.clippyArgs": [],
	// Arguments which is passed to cargo run
	"rust.runArgs": [],
	// Arguments which is passed to cargo test
	"rust.testArgs": [],
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
