# gtd-web
Web interface for [gtd-cli](https://github.com/AndrewCloete/gtd-cli)

To deploy run
```sh
./redeploy.sh
```

## Configuration

Create `src/config.json` (gitignored):

```json
{
  "scheme": "http",
  "ws_scheme": "ws",
  "backend_port": 10084,
  "user": "<basic-auth-user>",
  "psw": "<basic-auth-password>",
  "editor_scheme": "vscode"
}
```

`editor_scheme` controls the protocol used when Cmd-clicking a task to open it in your editor.
Common values: `"vscode"` (VS Code / Cursor), `"cursor"`, `"windsurf"`, `"zed"`.
Defaults to `"vscode"` if omitted.
