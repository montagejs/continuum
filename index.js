
// -1000px / 4000ms

var port = chrome.runtime.connect();
port.postMessage(["connect", chrome.devtools.inspectedWindow.tabId]);

port.onMessage.addListener(function (message, sender) {
    if (Array.isArray(message) && message.length) {
        var type = message[0];
        var handler = handlers[type];
        if (handler) {
            handler.apply(null, message.slice(1));
        }
    }
});

// todo consolidate model object
var resolvedElement = document.querySelector("#resolved");
var resolved = 0;
var pendingElement = document.querySelector("#pending");
var pending = 0;
var unhandledElement = document.querySelector("#unhandled");
var unhandled = 0;
var promisesElement = document.querySelector("#promises");
var promises = {};
var promisesLength = 0;
var maxPromisesLength = 300;

var calibration = 0;
function calibrate(timestamp) {
    calibration = Date.parse(timestamp) - Date.now();
}

function cull() {
    for (var id in promises) {
        var promise = promises[id];
        if (promise.state === "rejected" && !promise.handled) {
            continue;
        } else if (promisesLength > maxPromisesLength) {
            delete promises[id];
            promisesLength--;
        } else {
            break;
        }
    }
}

var handlers = {
    "showing-promises": function () {
        resolved = 0;
        pending = 0;
        unhandled = 0;
        length = 0;
        promises = {};
        // deliberately preserving expanded state for now.
        // seems to be useful sometimes.
        needsDraw();
    },
    "defer": function (id, stack, timestamp) {
        calibrate(timestamp);
        var message = "Deferred " + stack.split("\n")[0];
        promises[id] = {
            state: "pending",
            message: message,
            stack: stack,
            expanded: false,
            created: Date.parse(timestamp),
            resolved: null,
            progressNotes: [],
            progressNotesCount: 0,
            progress: null
        };
        cull();
        pending++;
        needsDraw();
    },
    "resolve": function (id, resolutionId, timestamp) {
        calibrate(timestamp);
        if (promises[id]) {
            var promise = promises[id];
            delete promises[id];
            promises[id] = promise;
            promise.state = "resolved";
            promise.resolution = promises[resolutionId];
            promise.resolved = Date.parse(timestamp);
        }
        pending--;
        resolved++;
        needsDraw();
    },
    "progress": function (id, progress, timestamp) {
        calibrate(timestamp);
        if (promises[id]) {
            var promise = promises[id];
            delete promises[id];
            promises[id] = promise;
            promise.progressNotes.push({
                progress: progress,
                created: Date.parse(timestamp)
            });
            if (promise.progressNotes.length > 20) {
                promise.progressNotes.splice(0, promise.progressNotes.length - 20);
            }
            promise.progressNotesCount++;
            promise.progress = progress;
        }
        needsDraw();
    },
    "fulfill": function (id, timestamp) {
        calibrate(timestamp);
        // something something somethings...dark side
    },
    "reject": function (id, message, stack, timestamp) {
        calibrate(timestamp);
        promises[id] = {
            state: "rejected",
            message: message,
            stack: stack,
            expanded: false,
            created: Date.parse(timestamp),
            handled: false
        };
        cull();
        unhandled++;
        needsDraw();
    },
    "handle": function (id, resolutionId, timestamp) {
        calibrate(timestamp);
        if (promises[id]) {
            if (!promises[id].handled) {
                unhandled--;
            }
            promises[id].handled = true;
            needsDraw();
        }
    }
};

var scheduledDraw;
function needsDraw() {
    if (scheduledDraw === undefined) {
        scheduledDraw = requestAnimationFrame(draw);
    }
}

function draw() {
    scheduledDraw = undefined;
    var ids = Object.keys(promises);
    var unhandled = ids.length;
    pendingElement.innerHTML = "" + pending;
    resolvedElement.innerHTML = "" + resolved;
    unhandledElement.innerHTML = "" + unhandled;
    promisesElement.innerHTML = "";
    ids.forEach(function (id) {
        var promise = promises[id];
        if (promise.state === "resolved")
            return;
        if (promise.state === "rejected" && promise.handled)
            return;
        if (promise.state === "fulfilled")
            return;
        var element = document.createElement("div");
        element.innerText = promise.message;
        element.classList.add("entry");
        element.classList.add(promise.state);
        element.dataset.id = id;
        promisesElement.appendChild(element);

        if (promise.state === "pending") {
            if (typeof promise.progress === "number" && !isNaN(promise.progress)) {
                var percent = (Math.max(0, Math.min(1, promise.progress)) * 100).toFixed(1);
                element.style.background = (
                    "-webkit-linear-gradient(" +
                        "left, " +
                        "#7db9e8 0%, " +
                        "#7db9e8 "+ percent + "%, " +
                        "white " + percent + "%, " +
                        "white 100%" +
                    ")"
                );
            } else if (promise.progressNotes.length) {
                var first = promise.progressNotes[0].created;
                var last;
                var length = 0;
                var stops = [];
                stops.push("white 0px");
                promise.progressNotes.map(function (note) {
                    var offsetMs = note.created - first;
                    var offsetPx = offsetMs / 4;
                    last = offsetPx;
                    stops.push("white " + offsetPx + "px, #7db9e8 " + offsetPx + "px");
                });
                stops.push("white " + (last + 100) + "px");
                element.style.background = (
                    "-webkit-linear-gradient(" +
                        "left, " + stops.join(", ") +
                    ")"
                );
                var offsetMs = Date.now() - calibration - first;
                var offsetPx = window.innerWidth - offsetMs / 4;
                element.style.backgroundRepeat = "no-repeat";
                element.style.backgroundPosition = offsetPx + "px";
                setTimeout(function () {
                    var durationMs = window.innerWidth * 4 + offsetMs;
                    element.style.WebkitTransition = "background-position " + durationMs + "ms linear";
                    element.style.backgroundPosition = "-" + window.innerWidth + "px";
                }, 0);
            } else {
                element.classList.add("indeterminate");
            }
        }

        if (promise.stack) {
            element.classList.add("expandable");
            var expanderElement = document.createElement("span");
            expanderElement.classList.add("arrow");
            expanderElement.innerText = promise.expanded ? "▼" : "▶";
            element.insertBefore(expanderElement, element.firstChild);

            if (promise.expanded) {
                var stackElement = document.createElement("div");
                stackElement.classList.add("entry", "stack");
                stackElement.innerText = promise.stack;
                promisesElement.appendChild(stackElement);
            }
        }

    });
}

window.addEventListener("click", function (event) {
    var element = event.target;
    while (element) {
        if (element.classList.contains("expandable")) {
            var id = element.dataset.id;
            var promise = promises[id];
            promise.expanded = !promise.expanded;
            needsDraw();
            break;
        }
        element = element.parentNode;
    }
}, true);

