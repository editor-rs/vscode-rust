# Rust Language Server Mode Page

The extension supports integration with [Rust Language Server](https://github.com/rust-lang-nursery/rls).

## Configuration

The `"rust.rls"` configuration parameter specifies how to run RLS if it is requested.

The type of the parameter is an object with the following fields:

* `"executable"` - a string. The path to an executable to execute
* `"args"` - an array of strings. Arguments to pass to the executable
* `"env"` - an environment to append to the current environment to execute the executable
* `"revealOutputChannelOn"` - a string. Specifies the condition when the output channel should be revealed

By default, it is `null`.

### The revealOutputChannelOn configuration parameter

This determines when the Output channel is revealed.

The possible values are:

* `"info"` - revealed on each info line
* `"warn"` - revealed on each warn line
* `"error"` - revealed on each error line (default)
* `"never"` - the output channel never reveals automatically

## Setting up

First of all, you have to download the [RLS](https://github.com/rust-lang-nursery/rls) sources:

```bash
git clone https://github.com/rust-lang-nursery/rls
```

Depending on whether you have rustup or not, there are different ways you can set up this plugin.

* [Setting up with rustup](#with-rustup)
* [Setting up without rustup](#without-rustup)

#### With rustup

Make sure you do have [rustup](https://github.com/rust-lang-nursery/rustup.rs) with nightly toolchain.

You can use RLS either installed or by running it from the source code.

If you want use RLS installed, but RLS hasn't been installed yet, perform the following steps in order to install RLS:

```bash
cd /path/to/rls
rustup run nightly cargo install
```

Because at the moment RLS links to the compiler and it assumes the compiler to be globally installed, one has to use rustup to start the `rls` (rustup will configure the environment accordingly):

```json
"rust.rls": {
    "executable": "rustup",
    "args": ["run", "nightly", "rls"]
}
```

--

You can also run from source by passing `+nightly` to rustup's cargo proxy:

```json
"rust.rls": {
    "executable": "cargo",
    "args": ["+nightly", "run", "--manifest-path=/path/to/rls/Cargo.toml", "--release"]
}
```

#### Without rustup

**Note:** You should do this only if you do not have rustup because otherwise rustup will not work anymore.

After you have cloned the sources, you need to download the latest nightly compiler. See the [Building section of the Rust repository](https://github.com/rust-lang/rust#building-from-source) for how to do this.

You can now install the Rust Language Server globally with

```bash
cd /path/to/rls
cargo install
```

and set `"executable"` to `"rls"`:

```json
"rust.rls": {
    "executable": "rls"
}
```

--

If you don't want to have it installed you can also run it from sources:

```json
"rust.rls": {
    "executable": "cargo",
    "args": ["run", "--manifest-path=/path/to/rls/Cargo.toml", "--release"]
}
```

## Debugging

There is an output channel named "Rust Language Server" which is used to show messages from RLS.

To open it, perform the following steps:

* Click "View" on the menu
* Click "Output" on submenu
* Click on the listbox which is to the right of the shown panel
* Choose "Rust Language Server"

For making RLS print more data, you have to add the following lines to your `"rust.rls"` configuration:

```json
"rust.rls": {
    ...
    "env": {
        "RUST_LOG": "rls=debug"
    }
}
```

## Status Bar Indicator

When the extension functions in RLS mode, an indicator is displayed in the status bar that shows the current status of RLS.

The indicator may show one of the following statuses:

* `Starting` - RLS is starting, hence no features of the extension are available
* `Crashed` - RLS has crashed, hence no features of the extensions are available
* `Analysis started` - RLS has begun analyzing code. Features are available, but the analysis is incomplete therefore possibly inaccurate
* `Analysis finished` - RLS has finished analyzing code. Features are available and the analysis should be accurate
* `Stopping` - RLS has been requested to stop. Features may or may not be available
* `Stopped` - RLS has been stopped. Features are unavailable

Clicking on the indicator restarts RLS.
