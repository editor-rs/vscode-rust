# Changelog

## 0.3.2

### Bug fixes

* Made ~ be expanded for `racerPath`, `rustfmtPath`, `rustsymPath`

* Fixed an unhandled exception if rustc wasn't installed 

## 0.3.1

### Features

* Added an output channel "Rust logging". Messages in the channel ease debugging

## 0.3.0

### Features

* Changed current working directory resolution strategy. Issue: [#36](https://github.com/KalitaAlexey/vscode-rust/issues/36)

* Added ability to create a playground. Issue: [#32](https://github.com/KalitaAlexey/vscode-rust/issues/32)

### Bug fixes

* Fixed exception when a cargo command is executed if there is no opened document. Issue: [#29](https://github.com/KalitaAlexey/vscode-rust/issues/29)

### Breaking changes

* Removed all specific commands (Cargo Build: Release, Cargo Run: Release). Added ability to defined a custom configurations

  For motivation look at [the issue #22](https://github.com/KalitaAlexey/vscode-rust/issues/22)

* Made process killing use SIGTERM instead of SIGINT. Issue: [#23](https://github.com/KalitaAlexey/vscode-rust/issues/23)

## 0.2.3

### Bug fixes

* `cargo clippy` outputs messages in JSON.

### Features

* Lines starting with "# " in code block in documentation isn't shown in hover. This is same how cargo doc renders code block.

* A cargo command output is flushed line by line. Before it was flushed at the end

## 0.2.2

### Fixes

Fixed lack of errors in the "Problems" panel and in a terminal for a cargo {check, run, test} invocation

## 0.2.1

This version is invalid

## 0.2.0

### Breaking changes

* ["cargo build" is invoked with "--message-format json". All other parsers were deleted](https://github.com/KalitaAlexey/vscode-rust/commit/5ea989bd52f90818486894e0fc22f1d92bce1a47)

  For motivation look at [the issue #1](https://github.com/KalitaAlexey/vscode-rust/issues/1)

* [Removed "features". Added "buildArgs", "checkArgs", "clippyArgs", "runArgs", "testArgs"](https://github.com/KalitaAlexey/vscode-rust/commit/63ef6357500a3ce954dea031246c7ac58cfca36a)

  For motivation look at [the issue #11](https://github.com/KalitaAlexey/vscode-rust/issues/11)

* [Removed "checkOnSave", "checkWith". Added "actionOnSave"](https://github.com/KalitaAlexey/vscode-rust/commit/efd51d9fe888aebd96da780385086ee1d4dee9a7)

  For motivation look at [the issue #10](https://github.com/KalitaAlexey/vscode-rust/issues/10)

### Fixes and not breaking changes

* [JSON-encoded diagnostic messages are well processed](https://github.com/KalitaAlexey/vscode-rust/commit/6c0891b7625b28b25cdaddb438b257e15408a025)
* [Extension activated upon a cargo command invocation](https://github.com/KalitaAlexey/vscode-rust/commit/d32655468f74c9d2eed0119021f0a92a9df0f597)
* [Messages in the "Problems" panel display only once](https://github.com/KalitaAlexey/vscode-rust/commit/72d587b09e8e9dc3de954f23855bc5219fa259c8)
* ["Cargo: Clippy" command is made available to call](https://github.com/KalitaAlexey/vscode-rust/commit/b5fc96bf879228a704b3e2ae5bd13868922e7678)
* [Fixed a problem with hover](https://github.com/KalitaAlexey/vscode-rust/commit/e5e9231d06c399bdc2202d7b4ea1b48e7daee5eb)

## 0.1.3

"add code here" in the snippets are commented

Documentation line limit in hover is removed

Leading spaces are removed from snippet labels

The error message for cancellation project creation is not shown 

Missing tools installation aware of cargo bin path 

## 0.1.2

Missing tools installation is performed with terminal instead of output channel

## 0.1.1

Added using of source code installed by rustup for racer

## 0.1.0

Forked it from https://github.com/saviorisdead/RustyCode