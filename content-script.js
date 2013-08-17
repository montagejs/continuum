
// Negotiate a connection between the content script and the browser page if
// possible.  Since the content script and page may be executed in any order
// relative to each other, the hand-shake must be order independent.  To
// facilitate this, either actor can initiate the handshake.
//
// If the content script loads first, it will wait for the browser page to send
// a "can-show-promises" challenge.  It will then send a "can-watch-promises"
// response.
//
// If the page loads first, the "can-show-promises" challenge will go ignored.
// The content script will send a "can-watch-promises" challenge.
//
// Either way, the page will receive a "can-watch-promises" message indicating
// that both the content script and browser page are ready to communicate.
// At that point, the page will send a "promise-channel" message with a message port
// to establish two way communication.  The content script will serve as a
// two-way message proxy between the page and the debugger.
//
// The content script for the Ember Inspector greatly informed this design,
// except that I have elected to use this message passing handshake instead of
// signaling and poling the DOM.
//
// https://github.com/tildeio/ember-extension/blob/b70735d72563dc0dc2e3b310e58efa226de68756/extension_dist/content-script.js

// XXX there is a chance that this will interfere with an existing message
// protocol
window.addEventListener("message", function (event) {
    var message = event.data;
    if (!Array.isArray(message))
        return;
    var type = message[0];
    if (type === "promise-channel") {
        connect(event.ports[0]);
    } else if (type === "can-show-promises") {
        window.postMessage(["can-watch-promises"], window.location.origin);
    }
});

window.postMessage(["can-watch-promises"], window.location.origin);

function connect(port) {
    port.addEventListener("message", function (event) {
        chrome.extension.sendMessage(event.data);
    });
    chrome.extension.onMessage.addListener(function (message) {
        port.postMessage(message);
    });
    port.start();
    chrome.extension.sendMessage(["showing-promises"]);
    port.postMessage(["watching-promises"]);
}

