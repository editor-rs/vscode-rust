# Linging Page

The extension provides linting which looks like in the following screenshot:

[![Linting](../images/linting/code.jpg)]()

Also it populates the Problems panel.

For the code:

```rust
fn foo(i: i32) {}

fn main() {
    foo(2i64);
}
```

The Problems panel looks like in the following screenshot:

[![Linting](../images/linting/problems_panel.jpg)]()

Linting works different in [Legacy Mode](legacy_mode/linting.md) and [RLS Mode](rls_mode/linting.md).
