# Rust Language Server Mode Page

The extension supports integration with [Rust Language Server].

## Configuration

There are configuration parameters which names start with `"rust.rls"`.
The RLS mode can be configured by changing the parameters.

### Parameters

#### rust.rls.executable

Using the parameter it is possible to specify either absolute path to RLS or name of RLS.

The default value is `"rls"`.

It can be useful when:

* There is a need in running RLS built from its source
* There is a need in running RLS through some proxy (see [rust.rls.args](#rust.rls.executable]))

#### rust.rls.args

Using the parameter it is possible to specify what arguments to run the RLS executable with.

The default value is `null`.

It can be useful when:

* There is a need in running RLS through some proxy, i.e., rustup

#### rust.rls.env

Using the parameter it is possible to specify what environment to run the RLS executable in.

The default value is `null`.

It can be useful when:

* There is a need to pass some environment variables to the RLS executable, i.e., `RUST_LOG`, `RUST_BACKTRACE`

#### rust.rls.revealOutputChannelOn

Using the parameter it is possible to specify on what kind of message received from the RLS the output channel is revealed.

It supports one of the following values:

* `"info"` - the output channel is revealed on literally all messages
* `"warn"` - the output channel is revealed on warnings
* `"error"` - the output channel is revealed on errors (default)
* `"never"` - the output channel is never revealed automatically (it can be revealed manually through *View->Output*)

The default value is `error`.

It can be useful when:

* There is some problem with RLS and it sometimes sends error messages on which the output channel is revealed and it is annoying
* There is a need in revealing the output channel on other kinds of message

#### rust.rls.useRustfmt

Using the parameter it is possible to specify if the standalone [rustfmt] is used to format code instead of the [rustfmt] embedded into RLS.

It supports one of the following values:

* `null` - the extension will ask if [rustfmt] is used to format code
* `false` - the extension will not use [rustfmt] to format code
* `true` - the extension will use [rustfmt] to format code

The default value is `null`.

## Setting up

The recommended way to set RLS up is using rustup. You should use rustup unless rustup does not suit you.

If you can't answer if rustup suits you, then it suits you.

### Using rustup

If rustup is installed on your computer, then when the extension activates it checks if RLS is installed and if it is not, then the extension asks your permission to update rustup and install RLS.

If you agree with this, the extension will do it and start itself in RLS mode.

You don't have to specify either settings to make RLS work because the extension will do it automatically.

### Using source

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
"rust.rls.executable": "rustup",
"rust.rls.args": ["run", "nightly", "rls"]
```

--

You can also run from source by passing `+nightly` to rustup's cargo proxy:

```json
"rust.rls.executable": "cargo",
"rust.rls.args": ["+nightly", "run", "--manifest-path=/path/to/rls/Cargo.toml", "--release"]
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
"rust.rls.executable": "rls"
```

--

If you don't want to have it installed you can also run it from sources:

```json
"rust.rls.executable": "cargo",
"rust.rls.args": ["run", "--manifest-path=/path/to/rls/Cargo.toml", "--release"]
```

## Debugging

There is an output channel named "Rust Language Server" which is used to show messages from RLS.

To open it, perform the following steps:

* Click "View" on the menu
* Click "Output" on submenu
* Click on the listbox which is to the right of the shown panel
* Choose "Rust Language Server"

For making RLS print more data, you have to add the following lines to your [RLS] configuration:

```json
"rust.rls.env": {
    "RUST_LOG": "rls=debug"
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

## Enabling formatting and renaming
Create a `rls.toml` file in your project's root and add `unstable_features = true` and RLS will be able to auto format on save and renaming.

[rustfmt]: https://github.com/rust-lang-nursery/rustfmt
[Rust Language Server]: https://github.com/rust-lang-nursery/rls
[RLS]: https://github.com/rust-lang-nursery/rls
