/*global chrome*/
var panelWindow, injectedPanel = false, injectedPage = false, panelVisible = false, savedStack = [];
chrome.devtools.panels.create("Promises", "continuum.png", "index.html");
