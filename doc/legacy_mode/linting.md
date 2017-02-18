# Legacy Mode Linting Page

Executing a cargo command makes the extension parse the output of the executed command and show diagnostics.

Let's assume we have the following code:

```rust
fn main() {
    let x = 5 + "10";
}
```

We execute any cargo command. Let's execute "Cargo: Build".

It builds and shows diagnostics:

* In code:

[![Linting](../../images/linting/code.jpg)]()

* In the Problems panel:

[![Linting](../../images/linting/problems_panel_legacy_mode.jpg)]()

We can hover any diagnostic to see what it is:

[![Linting](../../images/linting/code_hover_legacy_mode.jpg)]()
