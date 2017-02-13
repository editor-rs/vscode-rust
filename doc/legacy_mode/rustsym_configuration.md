# Rustsym Configuration Page

The extension supports only one configuration parameter to configure rustsym.

The `"rust.rustsymPath"` configuration parameter specifies a path to the rustsym's executable.

The possible values:

* `"Some path"` - the extension would try to use the path
* `null` - the extension would try to use the `PATH` variable of the environment

If the extension failed to start rustsym, navigation to a symbol wouldn't be available.
