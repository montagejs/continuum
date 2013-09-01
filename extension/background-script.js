/*global chrome*/

var ports = {};
var messages = {};

// For messages coming from content scripts
chrome.extension.onMessage.addListener(function (message, sender) {
    var id = sender.tab.id;
    var port = ports[id];
    if (port) {
        port.postMessage(message);
    } else {
        messages[id] = messages[id] || [];
        messages[id].push(message);
    }
});

// For connections coming from the web inspector
chrome.runtime.onConnect.addListener(function (port) {
    var id;
    port.onDisconnect.addListener(function () {
        if (ports[id]) {
            delete ports[id];
        }
    });
    port.onMessage.addListener(function (message) {
        // for the handshake message
        if (message[0] === "connect") {
            id = message[1]; // for us
            ports[id] = port; // for others
            // flush the queue of messages that were sent
            // before the connection was established
            if (messages[id]) {
                messages[id].forEach(function (message) {
                    port.postMessage(message);
                });
                delete messages[id];
            }
        } else {
            // XXX there is a chance we'll need to
            // filter messages
            chrome.tabs.sendMessage(id, message);
        }
    });
});

