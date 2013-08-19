/*global chrome*/
var panelWindow, injectedPanel = false, injectedPage = false, panelVisible = false, savedStack = [];
chrome.devtools.panels.create("Promises", "then-48.png", "index.html");
