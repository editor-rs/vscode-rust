# Format Page

The extension supports formatting the document opened in the active text editor on saving.

If the extension is runnning in [RLS Mode](rls_mode.md), formatting is performed via `rustfmt` integrated into RLS.

If the extension is running in [Legacy Mode](legacy_mode/main.md), formatting is performed via separate `rustfmt`.

Read more about [rustfmt configuration](legacy_mode/rustfmt_configuration.md) for Legacy Mode.

In order to format the document, make a right click and choose `"Format Document"`.

## Format On Save

The extension supports formatting the document opened in the active text editor on saving.

The `"rust.formatOnSave"` specifies whether the extension should format the active document on save.

By default, it is `false`.
