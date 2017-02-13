# Racer Configuration Page

The extension supports several configuration parameters to configure racer.

## Configuration Parameters

### Racer Path

The `"rust.racerPath"` configuration parameter specifies a path to the racer's executable.

The possible values:

* `"Some path"` - the extension would try to use the path
* `null` - the extension would try to use the `PATH` variable of the environment

If the extension failed to start racer, autocompletion wouldn't be available.

### Rust Source

The `"rust.rustLangSrcPath"` configuration parameter specifies a path to the `src` directory of Rust sources.

The possible values:

* `"Some path"` - the extension would try to use the path. If it failed the extension would try another ways to find Rust sources.
* `null` - the extension would try another ways to find Rust sources.

The extension tries finding Rust sources in different places:

* The `"rust.rustLangSrcPath"` configuration parameter
* The `RUST_SRC_PATH` variable of the environment
* Rust sources installed via Rustup

If the extension failed to find Rust sources, racer wouldn't provide autocompletion for the standard library.

### Cargo Home

The `"rust.cargoHomePath"` configuration parameter specifies a path to the home directory of Cargo.

I have never used this configuration parameter, but some people need it.
