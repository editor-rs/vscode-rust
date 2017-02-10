# Playground Creation Page

The extension provides a way to create a project in a platform-specific temporary directory.

The extension provides the command `"Cargo: Create playground"`.

If a user executes the command the extension shows a quick pick to let a developer choose what kind of project to create: an application or a library.

If user chooses any kind the extension performs the following steps:

* Creates a directory in a platform-specific directory
* Executes `cargo init ...` in the directory
* Opens the directory in a new window of Visual Studio Code
