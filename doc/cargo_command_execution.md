# Cargo Command Execution Page

The extension allows a developer to execute any of built-in cargo commands.

These commands are:

* bench
* build
* check
* clean
* clippy
* doc
* new
* run
* test
* update

These commands available through the command palette (CTRL+P).

These commands have prefix `"Cargo: "`.

## Execute Command On Save

The extension supports executing a command after saving the document opened in the active text document.

The `"rust.actionOnSave"` configuration parameter specifies a command to execute.

The possible values:

* `"build"` - the extension executes `"Cargo: Build"`
* `"check"` - the extension executes `"Cargo: Check"`
* `"clippy"` - the extension executes `"Cargo: Clippy"`
* `"run"` - the extension executes `"Cargo: Run"`
* `"test"` - the extension executes `"Cargo: Test"`
* `null` - the extension does nothing

By default, it is `null`.

## Current working directory determination
The extension executes a cargo command in some directory. To find out which directory the extension should use, the extension uses the following algorithm:

* Try making out the current working directory from the active text editor

  If all of the conditions are met:

    * There is an active text editor
    * A file opened in the editor is in the workspace (the opened directory)
    * There is a `Cargo.toml` file near the file or in the parent directories within the workspace

  Then use the directory containing the `Cargo.toml` file.

* Try using the previous current working directory
* Try using the workspace

## Configuration Parameters
### Cargo Path
The `"rust.cargoPath"` configuration parameter specifies a path to the cargo's executable.

The possible values:

* `"Some path"` - the extension would try to use the path
* `null` - the extension would try to use cargo from the `PATH` variable of the environment.

If cargo isn't available the extension can't execute a cargo command.

### Cargo Environment
The `"rust.cargoEnv"` configuration parameter specifies an environment which would be added to the general environment for executing a cargo command.

The possible values:

* Some object (`{ "RUST_BACKTRACE": 1 }`)
* `null`

### Passing Arguments
The extension supports several configuration parameters:

* `"rust.buildArgs"`
* `"rust.checkArgs"`
* `"rust.clippyArgs"`
* `"rust.runArgs"`
* `"rust.testArgs"`

The type of these configuration parameters is an array of strings.

These configuration parameters specify arguments which are passed to an appropriate command.

It is useful when you want the extension to execute `cargo build --features some_feature`.

These configuration parameters are used when one of the following commands is invoked:

* `"Cargo: Build"`
* `"Cargo: Check"`
* `"Cargo: Clippy"`
* `"Cargo: Run"`
* `"Cargo: Test"`

### Custom Configurations
The extension supports several configuration parameters:

* `"rust.customBuildConfigurations"`
* `"rust.customCheckConfigurations"`
* `"rust.customClippyConfigurations"`
* `"rust.customRunConfigurations"`
* `"rust.customTestConfigurations"`

The type of these configuration parameters is an array of objects.
The object must have the following fields:

* `"title"` - a string. It is shown as the label of a quick pick item if a cargo command has several custom configurations
* `"args"` - an array of strings. If a custom configuration is chosen, a cargo command is executed with the arguments from the custom configuration

These configuration parameters are used when one of the following commands is invoked:

* `"Cargo: Build using custom configuration"`
* `"Cargo: Check using custom configuration"`
* `"Cargo: Clippy using custom configuration"`
* `"Cargo: Run using custom configuration"`
* `"Cargo: Test using custom configuration"`

If any of the following commands is invoked, the extension decides what to do.

If none of the custom configurations for the command is defined the extension shows an error message.

If only one custom configuration for the command is defined the extension executes the command with the arguments from the custom configuration.

If many custom configurations for the command are defined the extension shows a quick pick with titles of the custom configurations to let a developer decide.

If a developer cancels the quick pick the extension does nothing.

If a developer chooses an item the extension executes the command with the arguments from the chosen configuration.
