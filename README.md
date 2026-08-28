# Host Jumper

Host Jumper is a [Firefox] [WebExtension] that jumps to saved relative paths on
  the current site.
Each path can include `{placeholders}` filled from the current page [URL].

Open the picker with `Ctrl+Shift+F` (the same chord on macOS) or the toolbar
  button.
Choose a path to replace the current origin's path, query, and hash, leaving
  the host unchanged.

## Requirements

- [Firefox] 140 or later

## Install

Install the signed add-on from [AMO].
Firefox keeps that build across restarts.

### From source

Clone this repository, then load it as a temporary add-on while you develop
  or review the code:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` in the repository root.

Firefox unloads a temporary add-on when the browser restarts.

[web-ext] can run a live reload session from the repository root.
That command needs [Node.js] 22 or later:

```sh
npx web-ext run
```

### From a GitHub Release

Download `host_jumper-*.zip` from a [GitHub Release].
Load the zip as a temporary add-on:
  choose the zip in the **Load Temporary Add-on** file dialog.

The GitHub zip is unsigned.
Release Firefox will not install it as a permanent add-on.

## Build

This repository has no bundler.
[web-ext] packages the files Firefox already loads.
Linting and packaging need [Node.js] 22 or later.

From the repository root:

```sh
npx web-ext lint
npx web-ext build
```

`web-ext lint` checks the manifest and source.
`web-ext build` writes `host_jumper-{version}.zip` under `web-ext-artifacts/`.

## Usage

1. Open the options page from the picker (**Configure paths**) or from
  `about:addons`.
2. Add a label and a path such as `/cart` or `/user?id={id,object}`.
3. On any `http:` or `https:` page, open the picker.
4. Type to filter, then press `Enter` to open the path in the same tab.
5. Press `Ctrl+Enter` (or `⌘Enter` on macOS) to open it in a new tab.

The picker is an overlay on injectable pages.
On privileged URLs, or when injection fails, it opens as a small window instead.

### Placeholders

`resolvePath` in `shared.js` keeps the current origin and substitutes tokens
  in the saved path.

| Token | Source |
| --- | --- |
| `{name}` | Query string, then hash parameters |
| `{1}`, `{2}`, `{n}` | Path segments, 1-based (`/a/b` → `{1}=a`, `{2}=b`) |
| `{id,object}` | First non-empty match among the listed names |

Query parameters override hash parameters and path-segment keys of the same
  name.
A missing token is replaced with an empty string.
The picker still lists that item and marks the missing names.

Examples:

- `/test` → `https://example.com/test`
- `/user?id={id,object}` on `/item?object=42` → `https://example.com/user?id=42`
- `/compare/{1}/{2}` on `/en/product/sku-9` → `https://example.com/compare/en/product`

### Configuration file

Options can export and import a [JSON] file (`host-jumper.json`) to copy paths
  between profiles or machines.
Import can replace the saved list or merge by path (duplicates are skipped).

```json
{
  "version": 1,
  "exportedAt": "2026-08-26T00:00:00.000Z",
  "paths": [
    { "label": "Cart", "path": "/cart" },
    { "label": "User", "path": "/user?id={id,object}" }
  ]
}
```

A bare JSON array of strings or `{ "label", "path" }` objects is also accepted.
`parseConfig` in `shared.js` assigns new ids on import.

## Permissions

The extension requests three permissions.
It collects no data (`data_collection_permissions.required` is `none` in
  `manifest.json`).

| Permission | Why |
| --- | --- |
| `storage` | Save the path list in [storage.local] |
| `tabs` | Read the current tab URL, update it, and open a new tab |
| `activeTab` | Inject the picker into the page the user invoked it on |

No host permission is declared.
The background script injects `picker.js` and `content_script.js` only after
  the user opens the picker on an `http:` or `https:` tab.
It skips `https://addons.mozilla.org/`.

## Repository layout

| Path | Role |
| --- | --- |
| `manifest.json` | [Manifest V2] metadata, permissions, commands, gecko id |
| `shared.js` | `HostJumper`: placeholders, storage, JSON import/export |
| `background_script.js` | Toolbar, shortcut, injection, navigation |
| `picker.js` | Picker UI used by the overlay and the popup window |
| `content_script.js` | Overlay host and closed [Shadow DOM] |
| `popup/` | Fallback picker window when the page cannot be injected |
| `options/` | Path editor, export, and import |
| `icons/` | Toolbar icon |

## Architecture

Design decisions live in [ARCHITECTURE.md].

## License

[MIT] © 2026 Viktar Nikifarau

[Firefox]: https://www.mozilla.org/firefox/
[Node.js]: https://nodejs.org/
[WebExtension]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
[URL]: https://url.spec.whatwg.org/
[web-ext]: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
[AMO]: https://addons.mozilla.org/firefox/addon/host-jumper/
[JSON]: https://www.json.org/json-en.html
[storage.local]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local
[Manifest V2]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/manifest_version
[Shadow DOM]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
[ARCHITECTURE.md]: ARCHITECTURE.md
[GitHub Release]: https://github.com/viktarnikifarau/host-jumper/releases
[MIT]: LICENSE
