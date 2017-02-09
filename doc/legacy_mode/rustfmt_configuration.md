# Rustfmt Configuration Page

The extension supports only one configuration parameter to configure rustfmt.

The `"rust.rustfmtPath"` configuration parameter specifies a path to the rustfmt's executable.

The possible values:

* `"Some path"` - the extension would try to use the path
* `null` - the extension would try to use the `PATH` variable of the environment

If the extension failed to start rustfmt, formatting wouldn't be available.
