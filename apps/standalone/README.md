# @roo-code/standalone

Standalone runtime target for Roo Code with a local backend host and embedded webview UI.

## Runtime target

- **Target:** desktop-style local runtime (local backend + local UI)
- **Backend:** Node server that loads the existing extension bundle via `@roo-code/vscode-shim`
- **Frontend:** existing `webview-ui` mounted without VS Code webview host APIs
- **Protocol boundary:** unchanged `WebviewMessage` (UI → host) and `ExtensionMessage` (host → UI)

## Development

1. Build the extension and webview UI:

```bash
pnpm --filter roo-cline bundle
pnpm --filter @roo-code/vscode-webview build
```

2. Start standalone host:

```bash
pnpm --filter @roo-code/standalone dev
```

3. Open:

```text
http://localhost:4178/?standalone=1
```

## Environment

- `ROO_WORKSPACE_PATH`: workspace root for file operations (default: repo root)
- `ROO_EXTENSION_DIST`: extension dist folder (default: `<repo>/src/dist`)
- `ROO_WEBVIEW_DIST`: webview build folder (default: `<repo>/src/webview-ui/build`)
- `PORT`: standalone server port (default: `4178`)
