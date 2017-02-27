# Format Page

The extension supports formatting the document opened in the active text editor on saving.

If the extension is runnning in [RLS Mode](rls_mode/main.md), formatting is performed via `rustfmt` integrated into RLS.

If the extension is running in [Legacy Mode](legacy_mode/main.md), formatting is performed via separate `rustfmt`.

Read more about [rustfmt configuration](legacy_mode/rustfmt_configuration.md) for Legacy Mode.

In order to format the document, make a right click and choose `"Format Document"`.
In Legacy Mode `"Format Selection"` is also available, although this feature of `rustfmt` is currently incomplete.

## Format On Save

Visual Studio Code supports formatting a document on saving.

Set `"editor.formatOnSave"` to `true` to make Visual Studio Code do that.
