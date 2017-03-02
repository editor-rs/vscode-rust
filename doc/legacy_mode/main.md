# Legacy Mode Main Page

This page describes what **Legacy Mode** is.

It is how the extension worked before the [Rust Language Server Mode](../rls_mode/main.md) had been added.

## Description

The extension supports the following features for this mode:

* Formatting the active document
* [Executing one of the built-in Cargo commands](../cargo_command_execution.md) and showing diagnostics (warnings, errors, etc.)
* Navigating to a symbol

## Required Tools

Legacy Mode requires the following tools to function:

* `racer`
* `rustfmt`
* `rustsym`

If any of the tools are not found, the extension will offer to install them. A "Rust Tools Missing" item in the status bar will also appear; click on the item to install the missing tools.

## Configuration

The extension supports configuration of the tools:

* [Racer Configuration](racer_configuration.md)
* [Rustfmt Configuration](rustfmt_configuration.md)
* [Rustsym Configuration](rustsym_configuration.md)

You may also configure Legacy Mode via configuration parameters.

## Configuration Parameters

### Show Output

The `"rust.showOutput"` configuration parameter controls whether the output channel should be shown when [a Cargo command starts executing](../cargo_command_execution.md).

The possible values:

* `true` - the output channel should be shown
* `false` - the output channel shouldn't be shown

The output channel will not be shown under any of the following conditions:

- `"rust.executeCargoCommandInTerminal"` is set to `true`
- `"rust.actionOnSave"` is set to `"check"`

### Executing Cargo commands in an integrated terminal

The `"rust.executeCargoCommandInTerminal"` configuration parameter controls whether [a Cargo command should be executed](../cargo_command_execution.md) in an integrated terminal.

By default, the extension executes Cargo commands as child processes. It then parses the output of the command and publishes diagnostics. Executing Cargo commands in an integrated terminal is useful if you need to run a binary and enter some text.

Unfortunately, there is currently no way to parse output of an integrated terminal. This means diagnostics cannot be shown in the editor.

The configuration parameter supports the following values:

* `true` - A Cargo command should be executed in an integrated terminal.
* `false` - A Cargo command should be executed as a child process.
