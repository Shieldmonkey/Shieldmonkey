import { setupBadgeListeners } from './badge';
import { setupGMListener } from './gmRequestHandler';
import { setupNavigationListener } from './navigation';
import { checkUserScriptsPermission } from './permissions';
import { reloadAllScripts } from './scripts';

import { setupMessageListener } from './messageHandler';

// Initialize userscripts environment
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Background Service Worker v0.2.1-debug loaded");
  await reloadAllScripts();
  await checkUserScriptsPermission();
});

chrome.runtime.onStartup.addListener(() => {
  checkUserScriptsPermission();
});

// Setup all listeners
setupBadgeListeners();
setupGMListener();
setupNavigationListener();
setupMessageListener();


// Generic notification click handler
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId) {
    chrome.runtime.openOptionsPage();
  }
});
