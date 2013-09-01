/**
 * @module ./main.reel
 */
var Component = require("montage/ui/component").Component,
    PressComposer = require("montage/composer/press-composer").PressComposer;

/**
 * @class Main
 * @extends Component
 */
exports.Main = Component.specialize(/** @lends Main# */ {
    constructor: {
        value: function Main() {
            this.super();
            this.promises = {};

            var handlers = this._handlers;
            for (var handler in handlers) {
                if (handlers.hasOwnProperty(handler)) {
                    handlers[handler] = handlers[handler].bind(this);
                }
            }

            this._pressComposer = PressComposer.create();
            this.addComposer(this._pressComposer);
        }
    },

    _pressComposer: {
        value: null
    },

    _resolvedElement: {
        value: null
    },

    _pendingElement: {
        value: null
    },

    _unhandledElement: {
        value: null
    },

    _promisesElement: {
        value: null
    },

    _port: {
        value: null
    },

    resolved: {
        value: 0
    },

    pending: {
        value: 0
    },

    unhandled: {
        value: 0
    },

    promises: {
        value: null
    },

    _promisesLength: {
        value: 0
    },

    _maxPromisesLength: {
        value: 300
    },

    _calibration: {
        value: 0
    },

    prepareForActivationEvents: {
        value: function() {
            this._pressComposer.addEventListener("press", this, false);
        }
    },

    templateDidLoad: {
        value: function() {
            this._connectToExtension();
        }
    },

    _connectToExtension: {
        value: function() {
            var port = this._port = chrome.runtime.connect();

            port.postMessage(["connect", chrome.devtools.inspectedWindow.tabId]);
            port.onMessage.addListener(this.handlePortMessage.bind(this));
        }
    },

    handlePortMessage: {
        value: function(message, sender) {
            if (Array.isArray(message) && message.length) {
                var type = message[0];
                var handler = this._handlers[type];
                if (handler) {
                    handler.apply(null, message.slice(1));
                }
            }
        }
    },

    handlePress: {
        value: function() {
            var element = event.target;
            while (element) {
                if (element.classList.contains("expandable")) {
                    var id = element.dataset.id;
                    var promise = this.promises[id];
                    promise.expanded = !promise.expanded;
                    this.needsDraw = true;
                    break;
                }
                element = element.parentNode;
            }
        }
    },

    draw: {
        value: function() {
            var promises = this.promises;
            var ids = Object.keys(promises);
            var unhandled = ids.length;
            this._pendingElement.innerHTML = "" + this.pending;
            this._resolvedElement.innerHTML = "" + this.resolved;
            this._unhandledElement.innerHTML = "" + unhandled;
            this._promisesElement.innerHTML = "";
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
                this._promisesElement.appendChild(element);

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
                        var last = 0;
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
                        var offsetMs = Date.now() - this._calibration - first;
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
                        this._promisesElement.appendChild(stackElement);
                    }
                }

            }, this);
        }
    },

    _calibrate: {
        value: function(timestamp) {
            this._calibration = Date.parse(timestamp) - Date.now();
        }
    },

    // todo consolidate model object
    _cull: {
        value: function cull() {
            var promises = this.promises;

            for (var id in promises) {
                var promise = promises[id];
                if (promise.state === "rejected" && !promise.handled) {
                    continue;
                } else if (this._promisesLength > this._maxPromisesLength) {
                    delete promises[id];
                    this._promisesLength--;
                } else {
                    break;
                }
            }
        }
    },

    _handlers: {
        value: {
            "showing-promises": function () {
                this.resolved = 0;
                this.pending = 0;
                this.unhandled = 0;
                this._promisesLength = 0;
                this.promises = {};
                // deliberately preserving expanded state for now.
                // seems to be useful sometimes.
                this.needsDraw = true;
            },
            "defer": function (id, stack, timestamp) {
                this._calibrate(timestamp);
                var message = "Deferred " + stack.split("\n")[0];
                this.promises[id] = {
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
                this._cull();
                this.pending++;
                this.needsDraw = true;
            },
            "resolve": function (id, resolutionId, timestamp) {
                var promises = this.promises;
                this._calibrate(timestamp);
                if (promises[id]) {
                    var promise = promises[id];
                    delete promises[id];
                    promises[id] = promise;
                    promise.state = "resolved";
                    promise.resolution = promises[resolutionId];
                    promise.resolved = Date.parse(timestamp);
                }
                this.pending--;
                this.resolved++;
                this.needsDraw = true;
            },
            "progress": function (id, progress, timestamp) {
                var promises = this.promises;
                this._calibrate(timestamp);
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
                this.needsDraw = true;
            },
            "fulfill": function (id, timestamp) {
                this._calibrate(timestamp);
                // something something somethings...dark side
            },
            "reject": function (id, message, stack, timestamp) {
                this._calibrate(timestamp);
                this.promises[id] = {
                    state: "rejected",
                    message: message,
                    stack: stack,
                    expanded: false,
                    created: Date.parse(timestamp),
                    handled: false
                };
                this._cull();
                this.unhandled++;
                this.needsDraw = true;
            },
            "handler": function (id, resolutionId, timestamp) {
                var promises = this.promises;
                this._calibrate(timestamp);
                if (promises[id]) {
                    if (!promises[id].handled) {
                        this._unhandled--;
                    }
                    promises[id].handled = true;
                    this.needsDraw = true;
                }
            }
        }
    }
});
