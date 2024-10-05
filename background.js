chrome.runtime.onInstalled.addListener(() => {
  console.log("Desk Saver installed.");
});

function saveCurrentDesk(deskName) {
  chrome.windows.getCurrent({ populate: true }, (window) => {
    const desk = [{
      tabs: window.tabs.map(tab => ({ url: tab.url, title: tab.title }))
    }];
    chrome.storage.local.set({ [deskName]: desk }, () => {
      console.log(`Desk ${deskName} saved.`);
    });
  });
}

function updateDesk(deskName) {
  chrome.windows.getCurrent({ populate: true }, (window) => {
    const desk = [{
      tabs: window.tabs.map(tab => ({ url: tab.url, title: tab.title }))
    }];
    chrome.storage.local.set({ [deskName]: desk }, () => {
      console.log(`Desk ${deskName} updated.`);
    });
  });
}

function restoreDesk(deskName) {
  chrome.storage.local.get(deskName, (result) => {
    const desk = result[deskName];
    if (desk) {
      desk.forEach(win => {
        chrome.windows.create({}, newWindow => {
          win.tabs.forEach((tab, index) => {
            if (index === 0) {
              chrome.tabs.update(newWindow.tabs[0].id, { url: tab.url });
            } else {
              chrome.tabs.create({ windowId: newWindow.id, url: tab.url });
            }
          });
        });
      });
    }
  });
}

function listDesks(sendResponse) {
  chrome.storage.local.get(null, (items) => {
    const deskNames = Object.keys(items);
    sendResponse(deskNames);
  });
}

function deleteDesk(deskName, sendResponse) {
  chrome.storage.local.remove(deskName, () => {
    sendResponse(`Desk ${deskName} deleted.`);
  });
}

function exportDesks(sendResponse) {
  chrome.storage.local.get(null, (items) => {
    const csvRows = [];
    csvRows.push("Desk Name,URL,Title");
    for (const [deskName, windows] of Object.entries(items)) {
      windows.forEach(window => {
        window.tabs.forEach(tab => {
          csvRows.push(`"${deskName}","${tab.url}","${tab.title}"`);
        });
      });
    }
    const csvString = csvRows.join("\n");
    sendResponse(csvString);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveDesk") {
    saveCurrentDesk(message.deskName);
  } else if (message.action === "updateDesk") {
    updateDesk(message.deskName);
  } else if (message.action === "restoreDesk") {
    restoreDesk(message.deskName);
  } else if (message.action === "listDesks") {
    listDesks(sendResponse);
    return true;  // indicates we'll call sendResponse asynchronously
  } else if (message.action === "deleteDesk") {
    deleteDesk(message.deskName, sendResponse);
    return true;  // indicates we'll call sendResponse asynchronously
  } else if (message.action === "exportDesks") {
    exportDesks(sendResponse);
    return true;  // indicates we'll call sendResponse asynchronously
  }
});
