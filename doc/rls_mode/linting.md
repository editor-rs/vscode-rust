# Linting in Rust Language Server Mode

RLS checks the project and shows diagnostics while you are typing.

You can see diagnostics in the Problems panel.

You can hover over a diagnostic to see what the problem is.

Executing a cargo command doesn't show any diagnostics (unlike [Legacy Mode](../legacy_mode/linting.md)).

It is intentional design decision.

The reason is that there is no pretty way to hide a diagnostic after the diagnostic's cause is fixed.

That (the showing of a problem which has been already fixed) may confuse people, hence the decision.
