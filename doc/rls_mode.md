# Rust Language Server Mode Page

The extension supports integration with [Rust Language Server](https://github.com/rust-lang-nursery/rls).

## Configuration

The `"rust.rls"` configuration parameter specifies how to run RLS if it is requested.

The type of the parameter is an object with the following fields:

* `"executable"` - a string. The path to an executable to execute
* `"args"` - an array of strings. Arguments to pass to the executable
* `"env"` - an environment to append to the current environment to execute the executable

By default, it is `null`.

## Instructions

* Clone the [Rust Language Server repository](https://github.com/rust-lang-nursery/rls) with

```bash
git clone https://github.com/rust-lang-nursery/rls
```

* Make sure you have [rustup](https://github.com/rust-lang-nursery/rustup.rs) with nightly toolchain

* Let nightly `cargo` run the rls

```json
"rust.rls": {
    "executable": "cargo",
    "args": ["+nightly", "run", "--manifest-path=/path/to/rls/Cargo.toml", "--release"]
}
```

**Note:** Remember that RLS requires nightly Rust, that's why you have to use `+nightly` here.

## Debugging

There is an output channel named "Rust Language Server" which is used to show messages from RLS.

To open it, perform the following steps:

* Click "View" on the menu
* Click "Output" on submenu
* Click on the listbox which is to the right of the shown panel
* Choose "Rust Language Server"

For making RLS print more data, refer the "Debug RLS" section below.

## Examples

#### RLS is installed

```json
"rust.rls": {
    "executable": "rls"
}
```

#### Source code of RLS is available

```json
"rust.rls": {
    "executable": "cargo",
    "args": ["run", "--manifest-path=/path/to/rls/Cargo.toml"]
}
```

#### Debug RLS

```json
"rust.rls": {
    ...
    "env": {
        "RUST_LOG": "rls=debug"
    }
}
```
