# Cargo Command Execution Page

The extension allows a developer to execute any of the inbuilt Cargo commands.

These commands are:

* `bench`
* `build`
* `check`
* `clean`
* `clippy`
* `doc`
* `new`
* `run`
* `test`
* `update`

These commands are available through the command palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) and have the prefix `"Cargo: "`.

## Execute Command On Save

The extension supports executing some of these commands after saving the active document. 

The `"rust.actionOnSave"` configuration parameter specifies which command to execute.

The possible values are:

* `"build"` - executes `"Cargo: Build"`
* `"check"` - executes `"Cargo: Check"`
* `"clippy"` - executes `"Cargo: Clippy"`
* `"doc"` - executes `"Cargo: Doc"`
* `"run"` - executes `"Cargo: Run"`
* `"test"` - executes `"Cargo: Test"`
* `null` - the extension does nothing (default)

## Finding Out Cargo.toml

Before executing the command, the extension needs to find out which `Cargo.toml` to use. The extension uses the following algorithm:

* Try to determine the current working directory from the active text editor

  If all of the following conditions are met:

  * There is an active text editor
  * A file opened in the editor is within the workspace (the directory opened in VS Code)
  * There is a `Cargo.toml` in the same directory as the active file or in any of the parent directories within the workspace

  Then use the `Cargo.toml` file that was found.

* Try using the previous `Cargo.toml` file
* Try using the `Cargo.toml` from the workspace

If the extension fails to find a `Cargo.toml`, an error message is shown.

## Finding Out The Working Directory

Before executing a Cargo command, the extension must find out which directory to execute the command in.

The extension supports the `"rust.cargoCwd"` configuration parameter with the following possible values:

* `"/some/path"` - the extension uses the specified path as the command's working directory
* `null` - the directory containing the chosen `Cargo.toml` is used as Cargo's working directory (default `cargo` behavior)

## Configuration Parameters

### Cargo Path

The `"rust.cargoPath"` configuration parameter specifies a path to the `cargo` executable with the following possible values:

* `"/some/path"` - the extension would try to use the path
* `null` - the extension would try to use `cargo` from the `PATH` environment variable.

If `cargo` isn't available, the extension can't execute any Cargo commands.

### Cargo Environment

The `"rust.cargoEnv"` configuration parameter specifies an environment variable which would be added to the general environment when executing a Cargo command.

The possible values are:

* `{ "Some": object }`
* `null`

#### Examples

```json
"rust.cargoEnv": { "RUST_BACKTRACE": 1 }
```

### Setting An Action To Handle Starting A New Command If There Is Another Command Running

The `"rust.actionOnStartingCommandIfThereIsRunningCommand"` configuration parameter specifies what the extension should do in case of starting a new command if there is a previous command running.

The possible values are:

* `"Stop running command"` - the extension will stop the previous running command and start a new one
* `"Ignore new command"` - the extension will ignore a request to start a new command
* `"Show dialog to let me decide"` - the extension will show an information box to let the user decide whether or not to stop a running command

### Passing Arguments

The extension supports several configuration parameters used to pass arguments on to the appropriate commands:

* `"rust.buildArgs"`
* `"rust.checkArgs"`
* `"rust.clippyArgs"`
* `"rust.docArgs"`
* `"rust.runArgs"`
* `"rust.testArgs"`

These parameters each take an array of strings. For example, you could configure the extension to execute `cargo build --features some_feature`.

These parameters are used when one of the following commands is invoked:

* `"Cargo: Build"`
* `"Cargo: Check"`
* `"Cargo: Clippy"`
* `"Cargo: Doc"`
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
* `"rust.customDocConfigurations"`
* `"rust.customRunConfigurations"`
* `"rust.customTestConfigurations"`

The type of these parameters is an array of objects and each object must have the following fields:

* `"title"` - a string. It is shown as the label of a quick pick item if a Cargo command has more than one custom configuration
* `"args"` - an array of strings. If a custom configuration is chosen, a Cargo command is executed with the arguments that were defined

These configuration parameters are used when one of the following commands is invoked:

* `"Cargo: Build using custom configuration"`
* `"Cargo: Check using custom configuration"`
* `"Cargo: Clippy using custom configuration"`
* `"Cargo: Doc using custom configuration"`
* `"Cargo: Run using custom configuration"`
* `"Cargo: Test using custom configuration"`

When one of these commands is invoked, the extension decides what to do:

* If there are no custom configurations defined for the command, the extension shows an error message.
* If only one custom configuration for the command is defined, the extension executes the customized command.
* If more than one custom configuration is defined, the extension shows a quick pick view, listing the title of each configuration to let the developer decide.
* If a developer cancels the quick pick, the extension does nothing.
* If a developer chooses an item, the extension executes the customized command.

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

##### Doc With Features

```json
"rust.customDocConfigurations": [
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
