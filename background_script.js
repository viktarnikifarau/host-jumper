const PICKER_WIDTH = 480;
const PICKER_HEIGHT = 420;
const SESSION_PENDING_TAB = "pendingTabId";
const SESSION_PICKER_WINDOW = "pickerWindowId";
const SESSION_BOOKMARK_SOURCE_TAB = "bookmarkSourceTabId";
const SESSION_BOOKMARK_WINDOW = "bookmarkWindowId";
const BOOKMARK_RESULT_LIMIT = 50;
const PICKER_FILES = ["shim.js", "picker.js", "content_script.js"];
const BLOCKED_URL_PREFIXES = [
  "https://addons.mozilla.org/",
  "https://chrome.google.com/webstore",
  "https://chromewebstore.google.com/"
];

const bookmarkSearchIndex = HostJumperBookmarkSearch.createIndex(browser.bookmarks);

function reportBookmarkIndexError(error) {
  console.error("Unable to update the bookmark index:", error);
}

browser.bookmarks.onCreated.addListener((id, node) => {
  bookmarkSearchIndex.onCreated(id, node).catch(reportBookmarkIndexError);
});
browser.bookmarks.onChanged.addListener((id, changeInfo) => {
  bookmarkSearchIndex.onChanged(id, changeInfo).catch(reportBookmarkIndexError);
});
browser.bookmarks.onRemoved.addListener((id) => {
  bookmarkSearchIndex.onRemoved(id).catch(reportBookmarkIndexError);
});
browser.bookmarks.onMoved.addListener((id, moveInfo) => {
  bookmarkSearchIndex.onMoved(id, moveInfo).catch(reportBookmarkIndexError);
});
browser.bookmarks.onImportEnded?.addListener(() => {
  bookmarkSearchIndex.onImportEnded().catch(reportBookmarkIndexError);
});
bookmarkSearchIndex.ready().catch(reportBookmarkIndexError);

browser.action.onClicked.addListener(() => {
  openPicker();
});

browser.commands.onCommand.addListener((command) => {
  if (command === "open-host-jumper") {
    return openPicker();
  }
  if (command === "open-bookmark-search") {
    return openBookmarkSearch();
  }
  return undefined;
});

browser.windows.onRemoved.addListener((windowId) => {
  clearPickerWindowId(windowId);
  clearBookmarkWindowId(windowId);
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "GET_PICKER_STATE") {
    return getPickerState();
  }

  if (message?.type === "NAVIGATE") {
    return navigateTo(message.url, sender.tab?.id, message.newTab, message.pathId);
  }

  if (message?.type === "SEARCH_BOOKMARKS") {
    return bookmarkSearchIndex.search(message.query, { limit: BOOKMARK_RESULT_LIMIT });
  }

  if (message?.type === "NAVIGATE_BOOKMARK") {
    return navigateBookmark(message.url, sender.tab?.id, message.newTab);
  }

  if (message?.type === "RECORD_USAGE") {
    return HostJumper.incrementPathUse(message.id);
  }

  if (message?.type === "OPEN_OPTIONS") {
    browser.runtime.openOptionsPage();
    return Promise.resolve();
  }

  return undefined;
});

async function openBookmarkSearch() {
  const tab = await getActiveTab();
  await setSessionValue(SESSION_BOOKMARK_SOURCE_TAB, tab?.id ?? null);
  await openBookmarkSearchWindow();
}

async function openPicker() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  await setSessionValue(SESSION_PENDING_TAB, tab.id);

  if (!isInjectableUrl(tab.url)) {
    await openPickerWindow();
    return;
  }

  try {
    await toggleOrOpenOverlay(tab);
  } catch (error) {
    await openPickerWindow();
  }
}

async function toggleOrOpenOverlay(tab) {
  try {
    await browser.tabs.sendMessage(tab.id, {
      type: "TOGGLE_PICKER",
      items: await getItemsForTab(tab)
    });
  } catch (error) {
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: PICKER_FILES
    });
    await browser.tabs.sendMessage(tab.id, {
      type: "TOGGLE_PICKER",
      items: await getItemsForTab(tab)
    });
  }
}

async function openPickerWindow() {
  await openSessionWindow(SESSION_PICKER_WINDOW, "popup/index.html");
}

async function openBookmarkSearchWindow() {
  await openSessionWindow(SESSION_BOOKMARK_WINDOW, "popup/index.html?mode=bookmarks");
}

async function openSessionWindow(sessionKey, url) {
  const existingId = await getSessionValue(sessionKey);
  if (existingId != null) {
    try {
      await browser.windows.remove(existingId);
    } catch (error) {
      // Window may already have been closed.
    }
    await setSessionValue(sessionKey, null);
  }

  const currentWindow = await browser.windows.getCurrent();
  const left = Math.round((currentWindow.left || 0) + ((currentWindow.width || PICKER_WIDTH) - PICKER_WIDTH) / 2);
  const top = Math.round((currentWindow.top || 0) + ((currentWindow.height || PICKER_HEIGHT) - PICKER_HEIGHT) / 2);
  const popup = await browser.windows.create({
    url: browser.runtime.getURL(url),
    type: "popup",
    width: PICKER_WIDTH,
    height: PICKER_HEIGHT,
    left,
    top
  });

  await setSessionValue(sessionKey, popup.id);
  try {
    await browser.windows.update(popup.id, { left, top, width: PICKER_WIDTH, height: PICKER_HEIGHT });
  } catch (error) {
    // Some platforms ignore explicit positioning.
  }
}

async function getPickerState() {
  const pendingTabId = await getSessionValue(SESSION_PENDING_TAB);
  const tab = pendingTabId != null
    ? await browser.tabs.get(pendingTabId).catch(() => null)
    : await getActiveTab();

  return {
    items: tab ? await getItemsForTab(tab) : [],
    currentUrl: tab?.url || "",
    canNavigate: Boolean(tab?.url && /^https?:/i.test(tab.url))
  };
}

async function getItemsForTab(tab) {
  if (!tab?.url || !/^https?:/i.test(tab.url)) {
    return [];
  }

  const paths = await HostJumper.getPaths();
  return HostJumper.buildPickerItems(paths, tab.url);
}

async function navigateTo(url, senderTabId, newTab, pathId) {
  const pendingTabId = await getSessionValue(SESSION_PENDING_TAB);
  const tabId = pendingTabId || senderTabId;
  if (!url) {
    return;
  }

  if (newTab) {
    const source = tabId ? await browser.tabs.get(tabId).catch(() => null) : null;
    const createProperties = { url, active: true };
    if (source?.id) {
      createProperties.openerTabId = source.id;
    }
    if (source?.windowId != null) {
      createProperties.windowId = source.windowId;
    }
    await browser.tabs.create(createProperties);
  } else if (tabId) {
    await browser.tabs.update(tabId, { url, active: true });
  } else {
    return;
  }

  try {
    await HostJumper.incrementPathUse(pathId);
  } finally {
    await closePickerWindow();
  }
}

async function navigateBookmark(url, senderTabId, newTab) {
  const sourceTabId = await getSessionValue(SESSION_BOOKMARK_SOURCE_TAB);
  const tabId = sourceTabId ?? senderTabId;
  if (!url) {
    return;
  }

  if (newTab) {
    const source = tabId ? await browser.tabs.get(tabId).catch(() => null) : null;
    const createProperties = { url, active: true };
    if (source?.id) {
      createProperties.openerTabId = source.id;
    }
    if (source?.windowId != null) {
      createProperties.windowId = source.windowId;
    }
    await browser.tabs.create(createProperties);
  } else if (tabId) {
    await browser.tabs.update(tabId, { url, active: true });
  } else {
    return;
  }

  await closeBookmarkSearchWindow();
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function isInjectableUrl(url) {
  return Boolean(url) && /^https?:/i.test(url) && !BLOCKED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

async function closePickerWindow() {
  await closeSessionWindow(SESSION_PICKER_WINDOW);
}

async function closeBookmarkSearchWindow() {
  await closeSessionWindow(SESSION_BOOKMARK_WINDOW);
}

async function closeSessionWindow(sessionKey) {
  const windowId = await getSessionValue(sessionKey);
  if (windowId == null) {
    return;
  }

  try {
    await browser.windows.remove(windowId);
  } catch (error) {
    // Already closed.
  }
  await setSessionValue(sessionKey, null);
}

async function clearPickerWindowId(windowId) {
  await clearSessionWindowId(SESSION_PICKER_WINDOW, windowId);
}

async function clearBookmarkWindowId(windowId) {
  await clearSessionWindowId(SESSION_BOOKMARK_WINDOW, windowId);
}

async function clearSessionWindowId(sessionKey, windowId) {
  const storedWindowId = await getSessionValue(sessionKey);
  if (windowId === storedWindowId) {
    await setSessionValue(sessionKey, null);
  }
}

async function getSessionValue(key) {
  const data = await browser.storage.session.get(key);
  return data[key] ?? null;
}

async function setSessionValue(key, value) {
  if (value == null) {
    await browser.storage.session.remove(key);
    return;
  }
  await browser.storage.session.set({ [key]: value });
}
