# Common Configuration Parameters

## rustup

Users should adjust properties of this configuration parameter to customize rustup.

### toolchain

This configuration parameter specifies which toolchain the extension will invoke rustup with.
It is used for getting sysroot, installing components, invoking Cargo

However there are few exceptions. Currently RLS is available for nightly hence RLS and rust-analysis are installed for the nightly toolchain.

### nightlyToolchain

This configuration parameter specifies which toolchain the extension will invoke rustup with.
It is used for installing RLS and related stuff.
