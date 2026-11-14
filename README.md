# Host Jumper

Host Jumper is a [Firefox] and [Chrome] [WebExtension] that jumps to saved
  relative paths on the current site.
Each path can include `{placeholders}` filled from the current page [URL].

Open the picker with `Alt+Shift+J` (Mnemonic of "Jump") on Windows/Linux or `Control+Shift+J` on
  macOS, or use the toolbar button.
Choose a path to replace the current origin's path, query, and hash, leaving
  the host unchanged.

## Requirements

- [Firefox] 140 or later
- [Chrome] 121 or later

## Install

Install the signed add-on from [AMO] or [Chrome Web Store].
Browsers keeps that build across restarts.

### From source

Clone this repository, then load it unpacked while you develop or review
  the code.

Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` in the repository root.

Firefox unloads a temporary add-on when the browser restarts.

Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repository root.

[web-ext] can run a live reload session from the repository root.
That command needs [Node.js] 22 or later:

```sh
npx web-ext run
npx web-ext run -t chromium
```

### From a GitHub Release

Download `host_jumper-*.zip` from a [GitHub Release].
In Firefox, load the zip as a temporary add-on:
  choose the zip in the **Load Temporary Add-on** file dialog.
In Chrome, unzip it and use **Load unpacked** on the extracted folder.

The GitHub zip is unsigned.
Release Firefox will not install it as a permanent add-on.

## Build

This repository has no bundler.
[web-ext] packages the files Firefox and Chrome already load.
Linting and packaging need [Node.js] 22 or later.

From the repository root:

```sh
node --test tests/*.test.js
npx web-ext lint
npx web-ext build
```

`web-ext lint` checks the manifest and source.
`web-ext build` writes `host_jumper-{version}.zip` under `web-ext-artifacts/`.

## Usage

1. Open the options page from the picker (**Configure paths**), from
  `about:addons`, or from `chrome://extensions`.
2. Add a label and a path such as `/cart` or `/user?id={id,object}`.
3. On any `http:` or `https:` page, open the picker.
4. Type to filter, then press `Enter` to open the path in the same tab.
5. Press `Ctrl+Enter` (or `⌘Enter` on macOS) to open it in a new tab.

The picker is an overlay on injectable pages.
On privileged URLs, or when injection fails, it opens as a small window instead.

### Keyboard shortcuts

| Action | Windows/Linux | macOS |
| --- | --- | --- |
| Open the path picker | `Alt+Shift+J` | `Control+Shift+J` |
| Search bookmarks | `Alt+Shift+K` | `Control+Shift+K` |

The manifest uses `Alt` for Windows/Linux and `MacCtrl` (the physical Control
  key) for macOS.
Unlike `Ctrl`, `MacCtrl` does not map to Command on macOS.
These Control-based shortcuts avoid the special characters that macOS can insert
  for Option-based shortcuts when an input is focused.
On Windows/Linux, `Ctrl+Shift+B` (bookmarks bar), `Ctrl+Shift+O` (bookmarks
  manager), and `Ctrl+Shift+P` (private window in Firefox/Zen) are
  browser-reserved.
On Windows/Linux, `Alt+Shift+B` is Chrome's focus-bookmarks-bar shortcut, and
  Chrome does not auto-assign reserved accelerators to extensions.
Bookmark search therefore uses `Alt+Shift+K` instead.
Users can rebind both shortcuts at `chrome://extensions/shortcuts` or
  `about:addons` > **Manage Extension Shortcuts**.

### Bookmark search

Open the bookmark search with `Alt+Shift+K` on Windows/Linux or
  `Control+Shift+K` on macOS.
Like the path picker, it is an overlay on injectable pages and opens as a small
  window on privileged URLs.
Every whitespace-separated token must match the bookmark's full folder path,
  title, or URL; token order does not matter.
Each result shows the bookmark name, full readable path, and URL.
Press `Enter` to open it in the current tab, or `Ctrl+Enter` (`⌘Enter` on macOS)
  to open a new tab.

For a bookmark titled **Server 1** under **CI > CI-1**, the query
  `ci-1 server 1` returns `CI > CI-1 > Server 1`.
Folder-only queries such as `ci ci-1` also work.
Folder matches, especially exact and consecutive folder segments, rank above
  title matches, which rank above URL-only matches.

To check updates manually, rename or move a folder and repeat its old and new
  path queries, then remove it and confirm its descendants no longer appear.
Duplicate bookmark titles remain separate results with distinct paths.
An empty query shows the search prompt and no bookmark results.

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
Usage counts stay in [storage.local] and are not written to or read from this
  file, so imported paths start at 0 uses.

## Permissions

The extension requests five permissions.
It collects no data (`data_collection_permissions.required` is `none` in
  `manifest.json`).

| Permission | Why |
| --- | --- |
| `storage` | Save the path list in [storage.local] |
| `tabs` | Read the current tab URL, update it, and open a new tab |
| `activeTab` | Inject the picker into the page the user invoked it on |
| `scripting` | Run [scripting.executeScript] after that user gesture |
| `bookmarks` | Index bookmark folders, titles, and URLs for popup search |

No host permission is declared.
The background script injects `shim.js`, `path_picker_client.js`, `picker.js`,
  and `content_script.js` only after the user opens the picker on an `http:` or
  `https:` tab.
It skips `https://addons.mozilla.org/` and the Chrome Web Store.

## Repository layout

| Path | Role |
| --- | --- |
| `manifest.json` | [Manifest V3] metadata, permissions, commands, gecko id |
| `shim.js` | Alias `chrome` as `browser` when the `browser` global is missing |
| `shared.js` | `HostJumper`: placeholders, storage, JSON import/export |
| `background.js` | Chrome service worker entry; `importScripts` of the files below |
| `background_script.js` | Toolbar, shortcut, injection, navigation, bookmark events |
| `bookmark_search.js` | Cached bookmark-tree index, token matching, and ranking |
| `bookmark_client.js` | Shared bookmark message protocol and popup data source |
| `path_picker_client.js` | Shared path-picker protocol for popup and overlay clients |
| `picker.js` | Shared picker variants, local filtering, and debounced async search |
| `content_script.js` | Overlay host and closed [Shadow DOM] |
| `popup/` | Fallback windows for the path picker and bookmark search |
| `options/` | Path editor, export, and import |
| `tests/` | Node tests for bookmark indexing, events, ranking, and integration |
| `icons/` | Toolbar and page icons; `icon.svg` is the source |

## Architecture

Design decisions live in [ARCHITECTURE.md].

## License

[MIT] © 2026 Viktar Nikifarau

[Firefox]: https://www.mozilla.org/firefox/
[Chrome]: https://www.google.com/chrome/
[Node.js]: https://nodejs.org/
[WebExtension]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
[URL]: https://url.spec.whatwg.org/
[web-ext]: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
[AMO]: https://addons.mozilla.org/firefox/addon/host-jumper/
[Chrome Web Store]: https://chromewebstore.google.com/detail/host-jumper/nogfefnephnobbmhmiagadolpjebpibk
[JSON]: https://www.json.org/json-en.html
[storage.local]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local
[Manifest V3]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/manifest_version
[scripting.executeScript]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript
[Shadow DOM]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
[ARCHITECTURE.md]: ARCHITECTURE.md
[GitHub Release]: https://github.com/viktarnikifarau/host-jumper/releases
[MIT]: LICENSE
