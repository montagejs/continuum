
var pre = document.querySelector("pre#console");
var rejectionsElement = document.querySelector("#rejections");

var port = chrome.runtime.connect();
port.postMessage(["connect", chrome.devtools.inspectedWindow.tabId]);

var resolved = 0;
var resolvedElement = document.querySelector("#resolved");
var pending = 0;
var pendingElement = document.querySelector("#pending");
var unhandledElement = document.querySelector("#unhandled");

port.onMessage.addListener(function (message, sender) {
    if (Array.isArray(message) && message.length) {
        var type = message[0];
        var handler = handlers[type] || noop;
        handler.apply(null, message.slice(1));
    }
});

function noop() {}

var rejections = {};
var stacks = {};
var expanded = {};

var handlers = {
    "showing-promises": function () {
        resolved = 0;
        pending = 0;
        rejections = {};
        // deliberately preserving expanded state for now.
        // seems to be useful sometimes.
        needsDraw();
    },
    "defer": function (id, stack, timestamp) {
        pending++;
        needsDraw();
    },
    "resolve": function (id, resolutionId, timestamp) {
        pending--;
        resolved++;
        needsDraw();
    },
    "reject": function (id, message, stack, timestamp) {
        rejections[id] = message;
        stacks[id] = stack;
        needsDraw();
    },
    "fulfill": function (id, timestamp) {
    },
    "handle": function (id, resolutionId, timestamp) {
        delete rejections[id];
        delete stacks[id];
        delete expanded[id];
        needsDraw();
    }
};

var scheduledDraw;
function needsDraw() {
    if (scheduledDraw == undefined) {
        scheduledDraw = requestAnimationFrame(draw);
    }
}

function draw() {
    scheduledDraw = undefined;
    var ids = Object.keys(rejections);
    var unhandled = ids.length;
    pendingElement.innerHTML = "" + pending;
    resolvedElement.innerHTML = "" + resolved;
    unhandledElement.innerHTML = "" + unhandled;
    rejectionsElement.innerHTML = "";
    ids.forEach(function (id) {
        var message = rejections[id];
        var rejectionElement = document.createElement("div");
        rejectionElement.className = "entry reject-entry " + (pending ? "warn-entry" : "error-entry");
        rejectionElement.innerText = message;
        rejectionElement.dataset.id = id;
        rejectionsElement.appendChild(rejectionElement);
        if (stacks[id]) {
            var expanderElement = document.createElement("span");
            expanderElement.classList.add("arrow");
            expanderElement.innerText = expanded[id] ? "▼" : "▶";
            rejectionElement.insertBefore(expanderElement, rejectionElement.firstChild);
        }
        if (expanded[id]) {
            var stackElement = document.createElement("div");
            stackElement.className = "entry stack-entry";
            stackElement.innerText = stacks[id];
            rejectionsElement.appendChild(stackElement);
        }
    });
}

window.addEventListener("click", function (event) {
    if (event.target.classList.contains("reject-entry")) {
        var id = event.target.dataset.id;
        expanded[id] = !expanded[id] && !!stacks[id];
        needsDraw();
    }
}, true);

