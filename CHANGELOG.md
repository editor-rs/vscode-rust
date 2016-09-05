# Changelog

# 0.18.0
- Added support for separate check command for libraries (@vhbit)
- Added support for exit code 4 when using diff mode in recent(master) versions of rustfmt (@trixnz)

# 0.17.0
- Added support for `rustsym` version 0.3.0 which enables searching for macros  (@trixnz)
- Added support for JSON error format and new (RUST_NEW_ERROR_FORMAT=true) error style (@trixnz)

# 0.16.1
- Fixed bug with filter for formatting (@trixnz)

# 0.16.0
- Snippets! (@trixnz)
- Fix for `rustsym` intergration

# 0.15.1
- Fixed a bug with check on save not working if formatting failed (@trixnz)

# 0.15.0
- Prevent the formatter from running on non-rust code files (@mooman219)
- Support for `rustsym` (@trixnz)

# 0.14.7
- Fix for issue when returned by `rustfmt` error code `3` brokes formatting functionality integration (@trixnz)

# 0.14.6
- Fix for `rustfmt` integration (@nlordell)

# 0.14.5
- Small typo fix for settings description (@juanfra684)

# 0.14.4
- Fixes for `rustfmt` integration (@junjieliang)

# 0.14.3
- Small fixes for `cargoHomePath` setting (@saviorisdead)

# 0.14.2
- Fixed some issues with `rustfmt` (@Draivin)
- Change extension options format (@fulmicoton)

# 0.14.1
- Preserve focus when opening `racer error` channel (@KalitaAlexey)

# 0.14.0
- Stabilized `rustfmt` functionality (@Draivin)
- Bumped version of `vscode` engine (@Draivin)
- Added option to specify `CARGO_HOME` via settings (@saviorisdead)

## 0.13.1
- Improved visual style of hover tooltips (@Draivin)

## 0.13.0
- Now it's possible to check Rust code with `cargo build` (@JohanSJA)
- Moved indication for racer to status bar (@KalitaAlexey)

## 0.12.0
- Added ability to load and work on multiple crates in one workspace (@KalitaAlexey)
- Added ability to display doc-comments in hover popup (@Soaa)
- Added `help` and `note` modes to diagnostic detection (@swgillespie)
- Various bug fixes and small improvements (@KalitaAlexey, @Soaa, )

## 0.11.0
- Added support for linting via `clippy` (@White-Oak)

## 0.10.0
- Added support for racer `tabbed text` mode.

## 0.9.1
- Fixed bug with missing commands (@KalitaAlexey)

## 0.9.0
- Removed unnecessary warnings (@KalitaAlexey)
- Added some default key-bindings (@KalitaAlaexey)

## 0.8.0
- Added linting on save support (@White-Oak)

## 0.7.1
- Fixed bug with incorrect signature help (@henriiik)

## 0.7.0
- Added support for multiline function call signature help (@henriiik)

## 0.6.0
- Added cargo commands for examples (@KalitaAlexey)

## 0.5.5
- Fixed issue with racer crashing on parentheses (@saviorisdead)

## 0.5.4
- Show errors after failed `cargo build` (@henriiik)

## 0.5.0
- Added `cargo terminate` command (@Draivin)

## 0.4.4
- Added standard messaged for missing executables (@Draivin)

## 0.4.3
- Added `cargoPath` option to extenstion options (@saviorisdead)

## 0.4.2
- Clear diagnostic collection on cargo run (@saviorisdead)

## 0.4.1
- Spelling corrected (@skade, @CryZe, @crumblingstatue)
- Added `cargo check` command and diagnostic handling to editor (@Draivin)
- Added option to view full racer error and restart error automatically (@Draivin)

## 0.4.0
- Various fixes of rustfmt integration (@saviorisdead, @KalitaAlexey, @Draivin)
- Cargo commands integration (@saviorisdead)
- Tests for formatting (@Draivin)

## 0.3.3
- Fixed bug with formatting using 'rustfmt' (@Draivin)
