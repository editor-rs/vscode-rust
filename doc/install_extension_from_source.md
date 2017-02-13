# Install Extension From Source Page

Sometimes you want to have something which is already in the repository, but isn't published on the marketplace yet.

There is a way to install the extension from the repository.

It requires `npm` (Node Package Manager). If you don't have it you should read about installation on <https://nodejs.org>

Furthermore I assume `npm` to be installed.

Clone the source of the extension

```
git clone https://github.com/KalitaAlexey/vscode-rust
```

Or you may just download it from https://github.com/KalitaAlexey/vscode-rust

Make the directory of the source be your current working directory

```
cd vscode-rust
```

Download all dependencies

```
npm install
```

You can run the extension from the source or prepare the package.

## Running From The Source

Running can be used to debug the extension or to try something out without overriding the extension.

In order to run the extension perform the following steps:

* Open the directory of the source in Visual Studio Code
* Press F5

It should open a new window with the latest version of the extension.

## Creating A Package

To prepare the package `vsce` is required.

To install `vsce` execute:

```
npm install -g vsce
```

To prepare the package execute:

```
vsce package
```

It should create **vscode-rust-<version>.vsix**.

## Install The Package

Open Visual Studio Code.

Open the "Extensions" tab in Visual Studio Code.

There is "..." to the right of the "Extensions" word.

Click on it.

Click on "Install from VSIX...".

Choose the created vsix file.

Restart Visual Studio Code.

Now you have the latest version.
