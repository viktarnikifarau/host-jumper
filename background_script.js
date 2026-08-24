const PICKER_WIDTH = 480;
const PICKER_HEIGHT = 420;

let pendingTabId = null;
let pickerWindowId = null;

browser.browserAction.onClicked.addListener(() => {
  openPicker();
});

browser.commands.onCommand.addListener((command) => {
  if (command === "open-host-jumper") {
    openPicker();
  }
});

browser.windows.onRemoved.addListener((windowId) => {
  if (windowId === pickerWindowId) {
    pickerWindowId = null;
  }
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "GET_PICKER_STATE") {
    return getPickerState();
  }

  if (message?.type === "NAVIGATE") {
    return navigateTo(message.url, sender.tab?.id);
  }

  if (message?.type === "OPEN_OPTIONS") {
    browser.runtime.openOptionsPage();
    return Promise.resolve();
  }

  return undefined;
});

async function openPicker() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  pendingTabId = tab.id;

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
    await browser.tabs.executeScript(tab.id, { file: "picker.js" });
    await browser.tabs.executeScript(tab.id, { file: "content_script.js" });
    await browser.tabs.sendMessage(tab.id, {
      type: "TOGGLE_PICKER",
      items: await getItemsForTab(tab)
    });
  }
}

async function openPickerWindow() {
  if (pickerWindowId != null) {
    try {
      await browser.windows.remove(pickerWindowId);
    } catch (error) {
      // Window may already have been closed.
    }
    pickerWindowId = null;
  }

  const currentWindow = await browser.windows.getCurrent();
  const left = Math.round((currentWindow.left || 0) + ((currentWindow.width || PICKER_WIDTH) - PICKER_WIDTH) / 2);
  const top = Math.round((currentWindow.top || 0) + ((currentWindow.height || PICKER_HEIGHT) - PICKER_HEIGHT) / 2);
  const popup = await browser.windows.create({
    url: browser.runtime.getURL("popup/index.html"),
    type: "popup",
    width: PICKER_WIDTH,
    height: PICKER_HEIGHT,
    left,
    top
  });

  pickerWindowId = popup.id;
  try {
    await browser.windows.update(popup.id, { left, top, width: PICKER_WIDTH, height: PICKER_HEIGHT });
  } catch (error) {
    // Some platforms ignore explicit positioning.
  }
}

async function getPickerState() {
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

  const paths = await FastPages.getPaths();
  return FastPages.buildPickerItems(paths, tab.url);
}

async function navigateTo(url, senderTabId) {
  const tabId = pendingTabId || senderTabId;
  if (!tabId || !url) {
    return;
  }

  await browser.tabs.update(tabId, { url, active: true });

  if (pickerWindowId != null) {
    try {
      await browser.windows.remove(pickerWindowId);
    } catch (error) {
      // Already closed.
    }
    pickerWindowId = null;
  }
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function isInjectableUrl(url) {
  return Boolean(url) && /^https?:/i.test(url) && !url.startsWith("https://addons.mozilla.org/");
}
