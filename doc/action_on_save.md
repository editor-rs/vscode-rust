# Action On Save Page

The extension supports executing an action after saving the document opened in the active text document.

The `"rust.actionOnSave"` configuration parameter specifies an action to execute.

The possible values:

* `"build"` - the extension executes `"Cargo: Build"`
* `"check"` - the extension executes `"Cargo: Check"`
* `"clippy"` - the extension executes `"Cargo: Clippy"`
* `"run"` - the extension executes `"Cargo: Run"`
* `"test"` - the extension executes `"Cargo: Test"`
* `null` - the extension does nothing

By default, it is `null`.

Read more about [Cargo command execution](cargo_command_execution.md).
