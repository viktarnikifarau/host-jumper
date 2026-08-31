# Architecture

Host Jumper is a [WebExtension] that opens saved relative paths on the current
  origin, filling `{placeholders}` from the current [URL].

The extension targets [Manifest V3] on [Firefox] 140+ and [Chrome] 121+.
Chrome Web Store rejects Manifest V2, and Firefox 140 still requires a gecko
  id, a minimum version, and `data_collection_permissions`.
Ship one `manifest.json` with `action`, `scripting`, and
  `browser_specific_settings.gecko`.
Do not keep a parallel Manifest V2 tree.

Chrome implements the MV3 background as a service worker.
Firefox still uses a non-persistent event page
  ([bug 1573659][Firefox SW bug]).
Chrome 121+ ignores `background.scripts` next to `service_worker`; older
  Chrome refuses the extra key.
Declare both: `scripts` for Firefox (`shim.js`, `shared.js`,
  `background_script.js`) and `service_worker` for Chrome (`background.js`).
`background.js` may only call `importScripts`.
Do not call `importScripts` from `background_script.js`; that throws in the
  Firefox event page.

The repository has no bundler, transpiler, or `package.json`.
AMO source review, Chrome unpacked loading, and [web-ext] load these files as
  the browsers load them.
Add a `.js` file and list it in `manifest.json` or the relevant HTML page.
Do not add a compile step that hides the shipped source.

The picker is not registered under `content_scripts`.
`background_script.js` calls [scripting.executeScript] only when the user
  opens the picker, using [activeTab] plus `tabs`, `storage`, and `scripting`.
That avoids running code on every page load.
It keeps the permission surface small for AMO and Chrome Web Store.
Do not add a match-all content script to make injection easier.

On injectable pages the picker is an overlay in the tab.
On privileged URLs (`about:`, `chrome:`, AMO, Chrome Web Store, non-`http(s)`)
  or failed injection, `openPickerWindow` opens `popup/index.html` as a
  480×420 window.
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
The Firefox event page, the Chrome service worker (via `importScripts`), and
  the options page are classic scripts, so this repo does not use ES modules.
Put new path-template behavior in `shared.js` so the picker, background, and
  options page stay consistent.

Chrome content scripts and extension pages expose `chrome`, not `browser`.
`shim.js` assigns `globalThis.browser = chrome` when `browser` is missing.
Load it before any script that calls `browser.*`: the background `scripts`
  list, `background.js`, `options/index.html`, `popup/index.html`, and the
  overlay injection file list.
Do not add [webextension-polyfill] or rewrite call sites to `chrome.*`.

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

The MV3 background can be killed while idle, so in-memory globals do not
  survive.
`pendingTabId` and `pickerWindowId` live in [storage.session].
Read and write them through the helpers in `background_script.js`.
Do not store that picker bookkeeping on a module-level `let`.

Chrome rejects SVG in the `icons` and `action.default_icon` keys.
The manifest ships PNG sizes 16, 32, 48, and 128.
Keep `icons/icon.svg` as the source and regenerate the PNGs from it.
Do not point the manifest at the SVG.

[WebExtension]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
[URL]: https://url.spec.whatwg.org/
[Manifest V3]: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
[Firefox]: https://www.mozilla.org/firefox/
[Chrome]: https://www.google.com/chrome/
[AMO]: https://addons.mozilla.org/
[web-ext]: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
[Firefox SW bug]: https://bugzilla.mozilla.org/show_bug.cgi?id=1573659
[scripting.executeScript]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript
[activeTab]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions#activetab_permission
[Shadow DOM]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
[Redirector]: https://github.com/einaregilsson/Redirector
[storage.local]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local
[storage.session]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session
[webextension-polyfill]: https://github.com/mozilla/webextension-polyfill
