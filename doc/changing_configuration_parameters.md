# Changing Configuration Parameters Page

## How To Set Configuration Parameters

Configuration parameters customize the extension's behavior. Snippets of these parameters are seen throughout the extension's documentation. As with most VS Code extensions, the file used to set these parameters is the same one used by VS Code itself: `settings.json`. The file can be accessed via <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and typing "user settings". Once open, every configuration parameter that the extension supports will be listed on the left-hand side under "Rust extension configuration". Copy them to the right-hand side to put them into effect.

### Example Snippet
```json
"rust.customRunConfigurations": [
  {
    "title": "Release",
    "args": [
      "--release"
    ]
  }
]
```

For more information, see the VS Code [User and Workspace Settings](https://code.visualstudio.com/docs/customization/userandworkspace) documentation.
