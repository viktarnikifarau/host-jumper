# Architecture

Host Jumper is a Firefox [WebExtension] that opens saved relative paths on the
  current origin, filling `{placeholders}` from the current [URL].

The extension targets Firefox [Manifest V2], not Chromium [Manifest V3].
Firefox 140+ still loads MV2 `background.scripts`.
[AMO] requires a gecko id, a minimum version, and `data_collection_permissions`.
Edit `manifest.json` as MV2 (`browser_action`, `background.scripts`,
  `browser_specific_settings.gecko`).
Do not switch to a service worker or a Chrome `action` key unless the Firefox
  target changes.

The repository has no bundler, transpiler, or `package.json`.
AMO source review and [web-ext] load these files as Firefox loads them.
Add a `.js` file and list it in `manifest.json` or the relevant HTML page.
Do not add a compile step that hides the shipped source.

The picker is not registered under `content_scripts`.
`background_script.js` calls [tabs.executeScript] only when the user opens the
  picker, using [activeTab] plus `tabs` and `storage`.
That avoids running code on every page load.
It keeps the AMO permission surface small.
Do not add a match-all content script to make injection easier.

On injectable pages the picker is an overlay in the tab.
On privileged URLs (`about:`, AMO, non-`http(s)`) or failed injection,
  `openPickerWindow` opens `popup/index.html` as a 480×420 window.
Both surfaces call `HostJumperPicker.mount` in `picker.js` (the window passes
  `embedded: true`).
Change picker behavior in `picker.js`; do not fork markup into `popup/`.

The overlay attaches a closed [Shadow DOM] so host CSS cannot restyle the
  dialog.
Host JS cannot reach it through `shadowRoot`.
Styles are a string inside `picker.js`, not a page stylesheet.
Do not switch to an open shadow or inject unscoped nodes into `document.body`.

URL parsing, placeholder expansion, storage, and JSON import/export live in
  `shared.js` as a global `HostJumper` IIFE.
MV2 background scripts and the options page are classic scripts, so this repo
  does not use ES modules.
Put new path-template behavior in `shared.js` so the picker, background, and
  options page stay consistent.

`resolvePath` keeps `url.origin` and fills `{name}` tokens from query
  parameters, hash parameters, and 1-based path segments.
`{id,object}` uses the first non-empty name.
Unlike [Redirector], this is an explicit jump, not an automatic rewrite.
It never changes host.
If a template cannot be filled, the picker still shows the URL and marks the
  missing names.
Do not block selection inside `shared.js`.

Paths are stored in [storage.local] under `paths`.
Export writes versioned JSON.
Import parses that object or a bare array.
It can replace or merge by path.
The extension has no sync backend, which matches AMO
  `data_collection_permissions.required: none`.
Do not send path lists to a server.
If the file format changes, bump `EXPORT_VERSION` and extend `serializeConfig`
  / `parseConfig`.

[WebExtension]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
[URL]: https://url.spec.whatwg.org/
[Manifest V2]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/manifest_version
[Manifest V3]: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
[AMO]: https://addons.mozilla.org/
[web-ext]: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
[tabs.executeScript]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/executeScript
[activeTab]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions#activetab_permission
[Shadow DOM]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
[Redirector]: https://github.com/einaregilsson/Redirector
[storage.local]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local
