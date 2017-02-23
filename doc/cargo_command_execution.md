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

These commands available through the command palette (<kbd>CTRL</kbd>+<kbd>P</kbd>).

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

## Finding Out Cargo.toml

Before executing the command the extension should find out what `Cargo.toml` to use.

To find out what `Cargo.toml` to use, the extension uses the following algorithm:

* Try making out the current working directory from the active text editor

  If all of the conditions are met:

    * There is an active text editor
    * A file opened in the editor is in the workspace (the opened directory)
    * There is a `Cargo.toml` file near the file or in the parent directories within the workspace

  Then use the `Cargo.toml` file.

* Try using the previous `Cargo.toml` file
* Try using the `Cargo.toml` from the workspace

If the extension failed to find `Cargo.toml` the extension would show an error message.

## Finding Out Working Directory

Before executing the command the extension should find out what directory to execute the command in.

The extension supports the `"rust.cargoCwd"` configuration parameter with the following possible values:

* `"/some/path"` - the extension would use the path as the command's working directory
* `null` - the extension would use the directory containing the chosen `Cargo.toml` as the command's working directory

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

### Setting An Action To Handle Starting A New Command If There Is Another Command Running

The `"rust.actionOnStartingCommandIfThereIsRunningCommand"` configuration parameter specifies what the extension should do in case of starting a new command if there is another command running.

The possible values are:

* `"Stop running command"` - the extension will stop another running command and start a new one
* `"Ignore new command"` - the extension will ignore a request to start a new command
* `"Show dialog to let me decide"` - the extension will show an information box to let the user decide whether or not to stop a running command


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

#### Examples

```json
"rust.buildArgs": ["--features", "some_feature"]
```

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

#### Examples

##### Build Example

```json
"rust.customBuildConfigurations": [
  {
    "title": "Example: my_example",
    "args": ["--example", "my_example"]
  }
]
```

##### Check With Features

```json
"rust.customCheckConfigurations": [
  {
    "title": "With Features",
    "args": ["--features", "feature1", "feature2"]
  }
]
```

##### Clippy With Features

```json
"rust.customClippyConfigurations": [
  {
    "title": "With Features",
    "args": ["--features", "feature1", "feature2"]
  }
]
```

##### Run With Arguments

```json
"rust.customRunConfigurations": [
  {
    "title": "With Arguments",
    "args": ["--", "arg1", "arg2"]
  }
]
```

##### Test No Run

```json
"rust.customTestConfigurations": [
  {
    "title": "No Run",
    "args": ["--no-run"]
  }
]
```
