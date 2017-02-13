# Legacy Mode Main Page

This page describes what **Legacy Mode** is.

It is how the extension worked before [Rust Language Server Mode](../rls_mode/main.md) had been added.

## Description

The extension supports the following features for this mode:

* Formatting the active document
* [Executing one of built-in cargo command](../cargo_command_execution.md) and showing diagnostics (warnings, errors and etc.)
* Navigating to a symbol

## Required Tools

It requires tools to function, which are:

* racer
* rustfmt
* rustsym

If any of the tools was not found the extension would suggest to install the missing tool.

If the extension failed to find any of the tools the "Rust Tools Missing" item in the status bar would appear.

Click on the item to install missing tools.

## Configuration

The extension supports configuration of the tools:

* [Racer Configuration](racer_configuration.md)
* [Rustfmt Configuration](rustfmt_configuration.md)
* [Rustsym Configuration](rustsym_configuration.md)

This mode supports configuration via the configuration parameters.

## Configuration Parameters

### Show Output

The `"rust.showOutput"` configuration parameter controls whether the output channel should be shown when [a cargo command is started executing](../cargo_command_execution.md).

The possible values:

* `true` - the output channel should be shown
* `false` - the output channel shouldn't be shown

### Execute Cargo command in a terminal

The `"rust.executeCargoCommandInTerminal"` configuration parameter controls whether [a cargo command should be executed](../cargo_command_execution.md) in an integrated terminal.

By default, the extension executes a cargo command as a child process.

Then it parses the output of the cargo command and publishes diagnostics.

However, it may be changed.

It is useful if you need to run a binary and enter some text.

Unfortunately, there is no way to parse output of an integrated terminal.

It means no diagnostics.

The configuration parameter supports the following values:

* `true` - A cargo command should be executed in an integrated terminal.
* `false` - A cargo command should be executed as a child process.
