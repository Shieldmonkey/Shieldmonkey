import { setupBadgeListeners } from './badge';
import { setupGMListener } from './gmRequestHandler';
import { setupNavigationListener } from './navigation';
import { checkUserScriptsPermission } from './permissions';
import { reloadAllScripts, preloadExampleScripts } from './scripts';
import { setupBackupAlarm, setupBackupListeners } from './backup';
import { setupMessageListener } from './messageHandler';

// Initialize userscripts environment
chrome.runtime.onInstalled.addListener(async () => {
  setupBackupAlarm();
  await preloadExampleScripts();
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
setupBackupListeners();

// Generic notification click handler
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId) {
    chrome.runtime.openOptionsPage();
  }
});
