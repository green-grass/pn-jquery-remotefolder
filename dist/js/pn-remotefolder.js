/*!
 * Remote Folder
 * Original author: Green Grass (http://nguyenngocminh.info)
 * Licensed under the MIT license
 * 
 * Dependencies:
 * - Modernizr
 * - jQuery
 * - Phantom Net Namespace and Inheritance
 */

(function () {

    "use strict";

    PN.namespace("PN.Components");

    var DEFAULT_EVENT_DOMAIN = ".remotefolder",

        FLOAT_LEFT_CSS_CLASS = "pull-left",
        FLOAT_RIGHT_CSS_CLASS = "pull-right",
        STRIPED_PROGRESS_CSS_CLASS = "progress-striped",
        ACTIVE_PROGRESS_CSS_CLASS = "active",
        UNSTYLED_LIST_CSS_CLASS = "list-unstyled",

        PANEL_CSS_CLASS = "panel",
        PANEL_HEADING_CSS_CLASS = "panel-heading",
        PANEL_TITLE_CSS_CLASS = "panel-title clearfix",
        PANEL_BODY_CSS_CLASS = "panel-body",
        NORMAL_PANEL_CSS_CLASS = "panel-info",
        SUCCESS_PANEL_CSS_CLASS = "panel-success",
        ERROR_PANEL_CSS_CLASS = "panel-danger",
        DISABLED_PANEL_CSS_CLASS = "panel-warning",

        IMAGE_CSS_CLASS = "img-responsive",

        PROGRESS_CSS_CLASS = "progress",
        PROGRESS_BAR_CSS_CLASS = "progress-bar",
        NORMAL_PROGRESS_BAR_CSS_CLASS = "progress-bar-info",
        SUCCESS_PROGRESS_BAR_CSS_CLASS = "progress-bar-success",
        ERROR_PROGRESS_BAR_CSS_CLASS = "progress-bar-danger",
        DISABLED_PROGRESS_BAR_CSS_CLASS = "progress-bar-warning",

        COMPONENT_CSS_CLASS = "remotefolder",
        ITEM_CSS_CLASS = "item",
        FILE_NAME_CSS_CLASS = "file-name",
        FILE_SIZE_CSS_CLASS = "file-size",
        UPLOAD_BUTTON_CSS_CLASS = "btn btn-link btn-lg",
        UPLOAD_BUTTON_ICON_CSS_CLASS = "glyphicon glyphicon-cloud-upload",
        UPLOAD_QUEUE_ITEM_BUTTON_CSS_CLASS = "btn btn-link btn-xs pull-right",
        RETRY_BUTTON_CSS_CLASS = "retry " + UPLOAD_QUEUE_ITEM_BUTTON_CSS_CLASS,
        RETRY_BUTTON_ICON_CSS_CLASS = "glyphicon glyphicon-refresh",
        CANCEL_BUTTON_CSS_CLASS = "cancel " + UPLOAD_QUEUE_ITEM_BUTTON_CSS_CLASS,
        CANCEL_BUTTON_ICON_CSS_CLASS = "glyphicon glyphicon-remove",
        EDIT_BUTTON_CSS_CLASS = "edit " + CANCEL_BUTTON_CSS_CLASS,
        EDIT_BUTTON_ICON_CSS_CLASS = "glyphicon glyphicon-pencil",
        DELETE_BUTTON_CSS_CLASS = "delete " + CANCEL_BUTTON_CSS_CLASS,
        DELETE_BUTTON_ICON_CSS_CLASS = "glyphicon glyphicon-trash",

        MULTIPLE_ATTRIBUTE = "multiple",
        CONTENTEDITABLE_ATTRIBUTE = "contenteditable";

    // CLASSES

    var UploadHandlerBase = PN.Class.extend({
        options: {
            onAdd: function (item) { },
            onUpload: function (item) { },
            onProgress: function (item, loaded, total) { },
            onComplete: function (item) { },
            onCancel: function (item) { },
            onSuccess: function (item) { },
            onError: function (item) { }
        },

        init: function (options) {
            this.options = $.extend({}, this.options, options);
        },

        add: function (input, createItem) {
            if (input.is("input")) {
                input.after(input.clone(true));
                input.remove();
            }
        },

        upload: function (item, url) {
            this.options.onUpload(item);
        },

        cancel: function (item) { },

        _handleResponse: function (item, response) {
            item.removeData("uploader");
            this.options.onComplete(item);
            if (response.success === true) {
                this.options.onSuccess(item);
            } else {
                this.options.onError(item);
            }
        }
    });

    var FormUploadHandler = UploadHandlerBase.extend({
        add: function (input, createItem) {
            var fileName = input.val(),
                item = createItem();
            item.data("file", input)
                .data("fileName", fileName)
                .data("fileSize", NaN);
            this.options.onAdd(item);
            this._super(input, createItem);
            return [item];
        },

        upload: function (item, url) {
            var that = this,
                id = new Date().valueOf(),
                iframe = this._createIframe(id, item),
                form = this._createForm(id, item.data("file"), url);

            item.data("uploader", iframe);

            iframe.load(function (e) {
                that._handleIframeLoad(e);
            });
            form.submit();
            form.remove();
            this._super(item);
        },

        cancel: function (item) {
            var uploader = item.data("uploader");
            if (uploader) {
                // To cancel request set src to something else
                // We use src="javascript:false;" because it doesn't trigger ie6 prompt on https
                uploader.attr("src", "javascript:false;");
                uploader.remove();
                item.removeData("uploader");
            }
            this.options.onComplete(item);
            this.options.onCancel(item);
        },

        _createIframe: function (id, item) {
            var ret = $("<iframe></iframe>").attr("src", "javascript:false;")
                                            .attr("id", id)
                                            .attr("name", id)
                                            .data("item", item)
                                            .hide();
            $(document.documentElement).append(ret);
            return ret;
        },

        _createForm: function (id, input, url) {
            var ret = $("<form></form>").attr("method", "post")
                                        .attr("enctype", "multipart/form-data")
                                        .attr("action", url)
                                        .attr("target", id)
                                        .append(input)
                                        .hide();
            input.attr("name", "file"); // !Important input must have a name for the file to be sent
            $(document.documentElement).append(ret);
            return ret;
        },

        _handleIframeLoad: function (e) {
            var iframe = e.target,
                $iframe = $(iframe),
                item = $iframe.data("item"),
                doc, response;

            // when we remove iframe from dom the request stops, but in IE load event fires
            if (!iframe.parentNode) {
                return;
            }

            try {
                // fixing Opera 10.53
                if (iframe.contentDocument &&
                    iframe.contentDocument.body &&
                    iframe.contentDocument.body.innerHTML === "false") {
                    // In Opera event is fired second time when body.innerHTML changed from false
                    // to server response approx. after 1 sec when we upload file with iframe
                    return;
                }
            } catch (e) { // Server error
                response = {};
            }

            if (!response) {
                // iframe.contentWindow.document - for IE<7
                doc = iframe.contentDocument ? iframe.contentDocument : iframe.contentWindow.document;
                try {
                    response = $.parseJSON(doc.body.innerHTML);
                } catch (e) {
                    response = {};
                }
            }

            $iframe.remove();

            this._handleResponse(item, response);
        }
    });

    var XhrUploadHandler = UploadHandlerBase.extend({
        add: function (input, createItem) {
            var that = this,
                ret = [];
            $.each(input[0].files, function (index, value) {
                var fileName = value.name || value.fileName,
                    fileSize = value.size || value.fileSize,
                    item = createItem();
                item.data("file", value)
                    .data("fileName", fileName)
                    .data("fileSize", fileSize);
                ret[index] = item;
                that.options.onAdd(item);
            });
            this._super(input, createItem);
            return ret;
        },

        upload: function (item, url, disableMultipart) {
            var that = this,
                file = item.data("file"),
                fileName = file.name || file.fileName;
            if (isMultiPartSupport() && !disableMultipart) {
                var fileId = item.data("fileId") || Date.now().valueOf() + "-" + fileName,
                    nextPartIndex = item.data("nextPartIndex") || 0;
                item.data("fileId", fileId);
                sendPart(fileId, nextPartIndex);
            } else {
                var xhr = new XMLHttpRequest(),
                    formData = new FormData();

                item.data("uploader", xhr);

                formData.append("file", file);

                xhr.upload.addEventListener("progress", function (e) {
                    var loaded = e.lengthComputable ? e.loaded : NaN,
                        total = e.lengthComputable ? e.total : NaN;
                    that.options.onProgress(item, loaded, total);
                }, false);

                xhr.addEventListener("load", function (e) {
                    var response;
                    try {
                        response = $.parseJSON(e.target.responseText);
                    } catch (e) {
                        response = {};
                    }
                    that._handleResponse(item, response);
                }, false);

                xhr.addEventListener("abort", function (e) {
                    item.removeData("uploader");
                    that.options.onComplete(item);
                    that.options.onCancel(item);
                }, false);

                xhr.addEventListener("error", function (e) {
                    item.removeData("uploader");
                    that.options.onComplete(item);
                    that.options.onError(item);
                }, false);

                xhr.open("POST", url, true);
                xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
                xhr.setRequestHeader("X-File-Name", encodeURIComponent(fileName));
                xhr.send(formData);
            }
            this._super(item);

            function isMultiPartSupport() {
                return typeof File !== "undefined" &&
                       typeof Blob !== "undefined" &&
                       typeof FileList !== "undefined" &&
                       (!!Blob.prototype.webkitSlice || !!Blob.prototype.mozSlice || !!Blob.prototype.slice || false);
            }

            function sendPart(fileId, index) {
                var partSize = 1048576, // 1 MB
                    xhr = new XMLHttpRequest(),
                    sliceFunc = file.slice ? "slice" : file.mozSlice ? "mozSlice" : file.webkitSlice ? "webkitSlice" : "slice",
                    part = file[sliceFunc](index * partSize, (index + 1) * partSize);

                item.data("uploader", xhr);

                xhr.upload.addEventListener("progress", function (e) {
                    var loaded = e.lengthComputable ? e.loaded : NaN,
                        total = e.lengthComputable ? file.size : NaN;
                    loaded += index * partSize;
                    that.options.onProgress(item, loaded, total);
                }, false);

                xhr.addEventListener("load", function (e) {
                    var response;
                    try {
                        response = $.parseJSON(e.target.responseText);
                    } catch (e) {
                        response = {};
                    }

                    index++;
                    if (partSize * index < file.size) {
                        if (response.success === true) {
                            item.data("nextPartIndex", index);
                            sendPart(fileId, index);
                        } else {
                            that._handleResponse(item, response);
                        }
                    } else {
                        that._handleResponse(item, response);
                    }
                }, false);

                xhr.addEventListener("abort", function (e) {
                    item.removeData("uploader");
                    that.options.onComplete(item);
                    that.options.onCancel(item);
                }, false);

                xhr.addEventListener("error", function (e) {
                    item.removeData("uploader");
                    that.options.onComplete(item);
                    that.options.onError(item);
                }, false);

                xhr.open("POST", url, true);
                xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
                xhr.setRequestHeader("X-File-ID", encodeURIComponent(fileId));
                xhr.setRequestHeader("X-File-Name", encodeURIComponent(fileName));
                xhr.setRequestHeader("X-Part-Index", encodeURIComponent(index));
                xhr.setRequestHeader("X-Part-Count", encodeURIComponent(Math.ceil(file.size / partSize)));
                xhr.setRequestHeader("X-Part-Size", encodeURIComponent(part.size));
                xhr.send(part);
            }
        },

        cancel: function (item) {
            var uploader = item.data("uploader");
            if (uploader) {
                uploader.abort();
            } else {
                this.options.onComplete(item);
                this.options.onCancel(item);
            }
        }
    });

    PN.Components.RemoteFolder = PN.Class.extend({
        container: $(),
        options: {
            listUrl: null,
            uploadUrl: null,
            renameUrl: null,
            deleteUrl: null,

            animationDuration: "fast",

            multiple: true,
            resume: false,

            dragAndDrop: true,
            dragAndDropTarget: window,

            autoRetryUpload: true,
            autoRetryUploadTimeout: 60000,
            autoClearUpload: true,
            autoClearUploadTimeout: 3000,
            autoClearFileListTimeout: 500,

            showSpeed: false,
            newToTop: true,

            urlFriendlyFileName: true,
            predefinedFileNames: [],

            uploadQueue: null,
            fileList: null,

            formatUploadButton: formatUploadButton,
            formatUploadQueueItem: formatUploadQueueItem,
            formatFileListItem: formatFileListItem,

            populateFileList: populateFileList,

            switchItemState: switchItemState,
            getItemState: getItemState
        },

        original: null,
        uploadQueue: $(),
        uploadHandler: new UploadHandlerBase(),
        fileList: $(),
        updateFileListJqXHR: null,

        init: function (container, options) {
            this.options = $.extend({}, this.options, options);
            this.container = $(container).addClass(COMPONENT_CSS_CLASS);
            this.original = this.container.html();

            var that = this;
            createUploadSection();
            if (this.options.fileList === null) {
                this.container.append(this.fileList = $("<ul></ul>").addClass(UNSTYLED_LIST_CSS_CLASS));
            } else {
                this.fileList = this.options.fileList;
            }
            updateFileList();

            function createUploadSection() {
                if (that.options.uploadQueue === null) {
                    that.container.append(that.uploadQueue = $("<ul></ul>").addClass(UNSTYLED_LIST_CSS_CLASS));
                } else {
                    that.uploadQueue = that.options.uploadQueue;
                }

                var options = {
                    onAdd: function (item) { onHandlerAdd(item); },
                    onUpload: function (item) { onHandlerUpload(item); },
                    onProgress: function (item, loaded, total) { onHandlerProgress(item, loaded, total); },
                    onComplete: function (item) { onHandlerComplete(item); },
                    onCancel: function (item) { onHandlerCancel(item); },
                    onSuccess: function (item) { onHandlerSuccess(item); },
                    onError: function (item) { onHandlerError(item); }
                };
                that.uploadHandler = isXhrSupported() ? new XhrUploadHandler(options) : new FormUploadHandler(options);

                createUploadButton().on("change" + DEFAULT_EVENT_DOMAIN, function () {
                    that.uploadHandler.add($(this), function () {
                        return that.options.formatUploadQueueItem();
                    });
                    processUploadQueue();
                });

                if (that.options.dragAndDrop === true) {
                    enableDragAndDrop();
                }

                function isXhrSupported() {
                    return isFileApiSupported() && isXhrProgressSupported();

                    function isFileApiSupported() {
                        var fi = document.createElement("input");
                        fi.type = "file";
                        return "files" in fi;
                    }

                    function isXhrProgressSupported() {
                        var xhr = new XMLHttpRequest();
                        return !!(xhr && "upload" in xhr && "onprogress" in xhr.upload);
                    }
                }

                function createUploadButton() {
                    var input = $("<input type=\"file\" />"),
                        button = that.options.formatUploadButton();
                    that.container.prepend(button.append(input));

                    if (that.options.multiple) {
                        input.attr(MULTIPLE_ATTRIBUTE, MULTIPLE_ATTRIBUTE);
                    }

                    // Make button suitable container for input
                    button.css({
                        position: "relative",
                        overflow: "hidden",
                        direction: "ltr" // Make sure browse button is in the right side in Internet Explorer
                    });

                    input.css({
                        position: "absolute",
                        right: "0", // In Opera only "Browse" button is clickable and it is located at the right side of the input
                        bottom: "0",
                        fontSize: "118px", // 4 persons reported this, the max values that worked for them were 243, 236, 236, 118
                        margin: "0",
                        padding: "0",
                        cursor: "pointer",
                        opacity: "0",
                        filter: "alpha(opacity=0)"
                    });
                    // IE and Opera, unfortunately have 2 tab stops on file input
                    // which is unacceptable in our case, disable keyboard access
                    if (window.attachEvent) {
                        // It is IE or Opera
                        input.attr("tabIndex", "-1");
                    }

                    return input;
                }

                function onHandlerAdd(item) {
                    var name = PN.Components.RemoteFolder.formatFileName(item.data("fileName"), true),
                        size = PN.Components.RemoteFolder.formatFileSize(item.data("fileSize")),
                        nameLabel = $("." + FILE_NAME_CSS_CLASS, item).html(name),
                        sizeLabel = $("." + FILE_SIZE_CSS_CLASS, item).html(size === "" ? "" : "0 KB / " + size),
                        retryButton = $("button." + RETRY_BUTTON_CSS_CLASS.split(" ")[0], item),
                        cancelButton = $("button." + CANCEL_BUTTON_CSS_CLASS.split(" ")[0], item),
                        deleteButton = $("button." + DELETE_BUTTON_CSS_CLASS.split(" ")[0], item),
                        progress = $("." + PROGRESS_CSS_CLASS, item),
                        progressBar = $("." + PROGRESS_BAR_CSS_CLASS, item);

                    item.data("status", "added");

                    if (FileReader) {
                        var reader = new FileReader(),
                            file = item.data("file");

                        reader.onload = function (event) {
                            var container = $("<div></div>"),
                                image = $("<img />");
                            container.css("height", 0)
                                     .append(image);
                            image.attr("src", event.target.result);
                            progress.prepend(container);
                        };
                        reader.readAsDataURL(file);
                    }

                    retryButton.on("click" + DEFAULT_EVENT_DOMAIN, function () {
                        switch (item.data("status")) {
                            case "added":
                                return;
                            case "uploading":
                                item.data("status", "retrying");
                                that.uploadHandler.cancel(item);
                                break;
                            case "retrying":
                                return;
                            case "completed":
                                item.data("status", "retrying");
                                cancelButton.show();
                                deleteButton.hide();
                                that.options.switchItemState(item, "Normal");
                                progressBar.removeClass(ERROR_PROGRESS_BAR_CSS_CLASS)
                                           .addClass(NORMAL_PROGRESS_BAR_CSS_CLASS);
                                break;
                            default:
                                return;
                        }
                        sizeLabel.html(size === "" ? "" : "0 KB / " + size);
                        retryButton.css("visibility", "hidden");
                        progressBar.width("0%");
                        progress.addClass(STRIPED_PROGRESS_CSS_CLASS).addClass(ACTIVE_PROGRESS_CSS_CLASS);
                        processUploadQueue();
                    });

                    cancelButton.on("click" + DEFAULT_EVENT_DOMAIN, function () {
                        that.uploadHandler.cancel(item);
                    });

                    deleteButton.one("click" + DEFAULT_EVENT_DOMAIN, function () {
                        $("button:visible", item).css("visibility", "hidden");
                        item.fadeOut(that.options.animationDuration, function () {
                            item.remove();
                            $(that).triggerHandler("queueitemremove", item);
                        });
                    });

                    if (isNaN(item.data("fileSize"))) {
                        progressBar.width("100%");
                    }

                    that.uploadQueue.append(item);
                    $(that).triggerHandler("queueitemadd", item);
                }

                function onHandlerUpload(item) {
                    item.data("status", "uploading");
                    if (that.options.autoRetryUpload) {
                        item.data("progressTimeout", window.setTimeout(function () {
                            $("button." + RETRY_BUTTON_CSS_CLASS.split(" ")[0], item).click();
                        }, that.options.autoRetryUploadTimeout));
                    }
                    if (that.options.showSpeed) {
                        item.data("speedInterval", window.setInterval(function () {
                            var previousLoaded = item.data("previousLoaded") || 0,
                                lastLoaded = item.data("lastLoaded") || 0;
                            item.data("speed", PN.Components.RemoteFolder.formatFileSize((lastLoaded - previousLoaded) / 2) + "/s | ");
                            item.data("previousLoaded", lastLoaded);
                        }, 2000));
                    }
                }

                function onHandlerProgress(item, loaded, total) {
                    if (that.options.autoRetryUpload) {
                        window.clearTimeout(item.data("progressTimeout"));
                    }

                    var speed = item.data("speed") || "",
                        size = speed + (isNaN(loaded) || isNaN(total) ? "" : PN.Components.RemoteFolder.formatFileSize(loaded) + " / " + PN.Components.RemoteFolder.formatFileSize(total)),
                        sizeLabel = $("." + FILE_SIZE_CSS_CLASS, item),
                        progressBar = $("." + PROGRESS_BAR_CSS_CLASS, item);

                    item.data("lastLoaded", loaded);
                    sizeLabel.html(size);
                    if (!isNaN(loaded) && !isNaN(total)) {
                        progressBar.width(loaded * 100 / total + "%");
                    }
                    if (that.options.autoRetryUpload) {
                        item.data("progressTimeout", window.setTimeout(function () {
                            $("button." + RETRY_BUTTON_CSS_CLASS.split(" ")[0], item).click();
                        }, that.options.autoRetryUploadTimeout));
                    }
                }

                function onHandlerComplete(item) {
                    if (that.options.autoRetryUpload) {
                        window.clearTimeout(item.data("progressTimeout"));
                    }
                    if (that.options.showSpeed) {
                        window.clearInterval(item.data("speedInterval"));
                    }
                    if (item.data("status") === "retrying") {
                        return;
                    }

                    var size = PN.Components.RemoteFolder.formatFileSize(item.data("fileSize")),
                        progress = $("." + PROGRESS_CSS_CLASS, item),
                        progressBar = $("." + PROGRESS_BAR_CSS_CLASS, item),
                        sizeLabel = $("." + FILE_SIZE_CSS_CLASS, item);

                    item.data("status", "completed");
                    processUploadQueue();
                    progress.removeClass(STRIPED_PROGRESS_CSS_CLASS).removeClass(ACTIVE_PROGRESS_CSS_CLASS);
                    progressBar.width("100%");
                    sizeLabel.html(size);
                }

                function onHandlerCancel(item) {
                    if (item.data("status") !== "completed") {
                        return;
                    }

                    var retryButton = $("button." + RETRY_BUTTON_CSS_CLASS.split(" ")[0], item),
                        cancelButton = $("button." + CANCEL_BUTTON_CSS_CLASS.split(" ")[0], item),
                        deleteButton = $("button." + DELETE_BUTTON_CSS_CLASS.split(" ")[0], item),
                        progressBar = $("." + PROGRESS_BAR_CSS_CLASS, item);

                    retryButton.css("visibility", "hidden");
                    autoRemoveUpload(item);
                    that.options.switchItemState(item, "Disabled");
                    cancelButton.hide();
                    deleteButton.show();
                    progressBar.removeClass(NORMAL_PROGRESS_BAR_CSS_CLASS).addClass(DISABLED_PROGRESS_BAR_CSS_CLASS);
                }

                function onHandlerSuccess(item) {
                    var retryButton = $("button." + RETRY_BUTTON_CSS_CLASS.split(" ")[0], item),
                        cancelButton = $("button." + CANCEL_BUTTON_CSS_CLASS.split(" ")[0], item),
                        progressBar = $("." + PROGRESS_BAR_CSS_CLASS, item);

                    autoRemoveUpload(item);
                    that.options.switchItemState(item, "Success");
                    retryButton.css("visibility", "hidden");
                    cancelButton.css("visibility", "hidden");
                    progressBar.removeClass(NORMAL_PROGRESS_BAR_CSS_CLASS).addClass(SUCCESS_PROGRESS_BAR_CSS_CLASS);
                    updateFileList();
                }

                function onHandlerError(item) {
                    var cancelButton = $("button." + CANCEL_BUTTON_CSS_CLASS.split(" ")[0], item),
                        deleteButton = $("button." + DELETE_BUTTON_CSS_CLASS.split(" ")[0], item),
                        progressBar = $("." + PROGRESS_BAR_CSS_CLASS, item);

                    that.options.switchItemState(item, "Error");
                    cancelButton.hide();
                    deleteButton.show();
                    progressBar.removeClass(NORMAL_PROGRESS_BAR_CSS_CLASS).addClass(ERROR_PROGRESS_BAR_CSS_CLASS);
                }

                function processUploadQueue() {
                    var maxUploadCount = 5,
                        count = maxUploadCount,
                        items = that.uploadQueue.children("." + ITEM_CSS_CLASS),
                        itemsToUpload = [],
                        uploadingCount = 0;

                    $.each(items, function (index, value) {
                        var item = $(value);
                        switch (item.data("status")) {
                            case "added":
                                if (count > 0) {
                                    itemsToUpload.push(item);
                                    count--;
                                }
                                break;
                            case "uploading":
                                uploadingCount++;
                                break;
                            case "retrying":
                                if (count > 0) {
                                    itemsToUpload.push(item);
                                    count--;
                                }
                                break;
                            case "completed":
                                break;
                            default:
                                break;
                        }
                    });
                    for (var i = 0; i < Math.min(itemsToUpload.length, maxUploadCount - uploadingCount) ; i++) {
                        var item = itemsToUpload[i];
                        that.uploadHandler.upload(item, that.options.uploadUrl, !that.options.resume);
                        $("button." + RETRY_BUTTON_CSS_CLASS.split(" ")[0], item).css("visibility", "");
                    }
                }

                function autoRemoveUpload(item) {
                    if (that.options.autoClearUpload) {
                        window.setTimeout(function () {
                            item.fadeOut(that.options.animationDuration, function () {
                                item.remove();
                                $(that).triggerHandler("queueitemremove", item);
                            });
                        }, that.options.autoClearUploadTimeout);
                    }
                }

                function enableDragAndDrop() {
                    if (!isXhrSupported()) {
                        return;
                    }

                    $(that.options.dragAndDropTarget)
                        .on("dragover dragenter", function (e) {
                            e.preventDefault();
                        })
                        .on("dragleave", function (e) {
                            e.preventDefault();
                        })
                        .on("drop", function (e) {
                            e.preventDefault();

                            if (e.originalEvent.dataTransfer === null) {
                                // Unsupported
                                return;
                            }

                            var files = e.originalEvent.dataTransfer.files,
                                input = $({ files: files });
                            that.uploadHandler.add(input, function () {
                                return that.options.formatUploadQueueItem();
                            });
                            processUploadQueue();
                        });
                }
            }

            function updateFileList() {
                that.updateFileListJqXHR = $.getJSON(that.options.listUrl, function (data, textStatus, jqXHR) {
                    if (jqXHR !== that.updateFileListJqXHR) {
                        return;
                    }
                    that.updateFileListJqXHR = null;

                    if (data.success) {
                        that.options.populateFileList(that, data.items);
                    } else {
                        onGetError();
                    }
                })
                .error(function () { onGetError(); });

                function onGetError() {
                }
            }
        },

        destroy: function () {
            var that = this,
                uploadItemList = this.uploadQueue.children("." + ITEM_CSS_CLASS),
                fileItemList = this.fileList.children("." + ITEM_CSS_CLASS);

            $.each(uploadItemList, function (index, value) {
                that.uploadHandler.cancel($(value));
            });

            this.updateFileListJqXHR = null;

            $.each(fileItemList, function (index, value) {
                $(value).removeData("deleteJqXHR");
            });

            this.container.html(this.original);
            this.original = null;
        },

        items: function () {
            return this.fileList.children("." + ITEM_CSS_CLASS);
        }
    });

    $.extend(PN.Components.RemoteFolder, {
        formatFileName: function (path, truncate) {
            var ret = PN.Components.RemoteFolder.getFilename(path);
            if (truncate) {
                ret = PN.Components.RemoteFolder.truncateString(ret, 50, 15);
            }
            return ret;
        },

        getFilename: function (path) {
            return path.replace(/.*(\/|\\)/, '');
        },

        truncateString: function (str, maxSize, taleSize) {
            if (str.length > maxSize) {
                str = str.slice(0, maxSize - taleSize - 1) + "..." + str.slice(0 - taleSize);
            }
            return str;
        },

        formatFileSize: function (fileSize) {
            if (isNaN(fileSize)) { return ""; }

            var i = -1;
            do {
                fileSize = fileSize / 1024;
                i++;
            } while (fileSize > 999);

            return Math.max(fileSize, 0.1).toFixed(0) + " " + ["KB", "MB", "GB", "TB", "PB", "EB"][i];
        }
    });

    function formatUploadButton() {
        return $("<div></div>").addClass(UPLOAD_BUTTON_CSS_CLASS)
                               .append("<span class=\"" + UPLOAD_BUTTON_ICON_CSS_CLASS + "\"></span>");
    }

    function formatUploadQueueItem() {
        var ret, retryButton, cancelButton, deleteButton, progress,
            panelHeading = $("<div></div>").addClass(PANEL_HEADING_CSS_CLASS),
            panelTitle = $("<div></div>").addClass(PANEL_TITLE_CSS_CLASS),
            panelBody = $("<div></div>").addClass(PANEL_BODY_CSS_CLASS),
            panel = $("<div></div>").addClass(PANEL_CSS_CLASS).addClass(NORMAL_PANEL_CSS_CLASS),
            nameLabel = $("<span></span>").addClass(FILE_NAME_CSS_CLASS).addClass(FLOAT_LEFT_CSS_CLASS),
            sizeLabel = $("<span></span>").addClass(FILE_SIZE_CSS_CLASS).addClass(FLOAT_RIGHT_CSS_CLASS);

        retryButton = $("<button></button>").addClass(RETRY_BUTTON_CSS_CLASS)
                                             .append("<span class=\"" + RETRY_BUTTON_ICON_CSS_CLASS + "\"></span>");
        cancelButton = $("<button></button>").addClass(CANCEL_BUTTON_CSS_CLASS)
                                             .append("<span class=\"" + CANCEL_BUTTON_ICON_CSS_CLASS + "\"></span>");
        deleteButton = $("<button></button>").addClass(DELETE_BUTTON_CSS_CLASS)
                                             .append("<span class=\"" + DELETE_BUTTON_ICON_CSS_CLASS + "\"></span>");
        progress = $("<div></div>").addClass(PROGRESS_CSS_CLASS).addClass(STRIPED_PROGRESS_CSS_CLASS).addClass(ACTIVE_PROGRESS_CSS_CLASS)
                                   .append($("<div></div>").addClass(PROGRESS_BAR_CSS_CLASS).addClass(NORMAL_PROGRESS_BAR_CSS_CLASS));
        ret = $("<li></li>").addClass(ITEM_CSS_CLASS)
                            .append(panel.append(panelHeading.append(panelTitle.append(deleteButton.hide())
                                                                               .append(cancelButton)
                                                                               .append(retryButton)
                                                                               .append(sizeLabel)
                                                                               .append(nameLabel)))
                                         .append(panelBody.append(progress)));
        return ret;
    }

    function formatFileListItem(file) {
        var ret, editButton, deleteButton, progress,
            panelHeading = $("<div></div>").addClass(PANEL_HEADING_CSS_CLASS),
            panelTitle = $("<div></div>").addClass(PANEL_TITLE_CSS_CLASS),
            panelBody = $("<div></div>").addClass(PANEL_BODY_CSS_CLASS),
            panel = $("<div></div>").addClass(PANEL_CSS_CLASS).addClass(NORMAL_PANEL_CSS_CLASS),
            nameLabel = $("<span></span>").addClass(FILE_NAME_CSS_CLASS).addClass(FLOAT_LEFT_CSS_CLASS),
            sizeLabel = $("<span></span>").addClass(FILE_SIZE_CSS_CLASS).addClass(FLOAT_RIGHT_CSS_CLASS),
            image = $("<img />").addClass(IMAGE_CSS_CLASS)
                                .attr("src", file.absoluteUrl)
                                .css("display", file.absoluteUrl ? "" : "none");

        editButton = $("<button></button>").addClass(EDIT_BUTTON_CSS_CLASS)
                                           .append("<span class=\"" + EDIT_BUTTON_ICON_CSS_CLASS + "\"></span>");
        deleteButton = $("<button></button>").addClass(DELETE_BUTTON_CSS_CLASS)
                                             .append("<span class=\"" + DELETE_BUTTON_ICON_CSS_CLASS + "\"></span>");
        progress = $("<div></div>").hide()
                                   .addClass(PROGRESS_CSS_CLASS).addClass(STRIPED_PROGRESS_CSS_CLASS).addClass(ACTIVE_PROGRESS_CSS_CLASS).addClass(FLOAT_RIGHT_CSS_CLASS)
                                   .append($("<div></div>").addClass(PROGRESS_BAR_CSS_CLASS).addClass(ERROR_PROGRESS_BAR_CSS_CLASS)
                                                           .width("100%"));
        ret = $("<li></li>").addClass(ITEM_CSS_CLASS)
                            .append(panel.append(panelHeading.append(panelTitle.append(progress)
                                                                               .append(deleteButton)
                                                                               .append(editButton)
                                                                               .append(sizeLabel)
                                                                               .append(nameLabel)))
                                         .append(panelBody.append(image)));
        return ret;
    }

    function populateFileList(target, items) {
        /// <signature>
        ///   <param name="target" type="PN.Components.RemoteFolder" />
        ///   <param name="items" type="Array" />
        /// </signature>

        var oldItems = target.fileList.children("." + ITEM_CSS_CLASS);

        $.each(oldItems, function (index, value) {
            var item = $(value),
                file = item.data("file"),
                onList = false;

            if (file && file.fileName) {
                $.each(items, function (index, value) {
                    if (value.fileName === file.fileName) {
                        item.data("file", value);
                        onList = true;
                        return false;
                    }
                });
            }

            if (!onList) {
                item.fadeOut(target.options.animationDuration, function () {
                    item.remove();
                    $(target).triggerHandler("filelistitemremove", item);
                });
            }
        });

        $.each(items, function (index, value) {
            var fileName = value.fileName,
                onList = false;

            $.each(oldItems, function (index, value) {
                var item = $(value),
                    file = item.data("file");

                if (file && file.fileName === fileName) {
                    onList = true;
                    return false;
                }
            });

            if (!onList) {
                addToFileList(value);
            }
        });

        $(target).triggerHandler("filelistupdate", [items]);

        function addToFileList(file) {
            var name = PN.Components.RemoteFolder.formatFileName(file.fileName, true),
                fullName = PN.Components.RemoteFolder.formatFileName(file.fileName, false),
                size = PN.Components.RemoteFolder.formatFileSize(file.fileSize),
                item = target.options.formatFileListItem(file).data("file", file).data("fullName", fullName),
                nameLabel = $("." + FILE_NAME_CSS_CLASS, item).html(name),
                sizeLabel = $("." + FILE_SIZE_CSS_CLASS, item).html(size),
                editButton = $("button." + EDIT_BUTTON_CSS_CLASS.split(" ")[0], item),
                deleteButton = $("button." + DELETE_BUTTON_CSS_CLASS.split(" ")[0], item),
                progress = $("." + PROGRESS_CSS_CLASS, item);

            if (target.options.predefinedFileNames.length > 0) {
                var content = $("<ul></ul>").addClass(UNSTYLED_LIST_CSS_CLASS);
                $.each(target.options.predefinedFileNames, function (index, value) {
                    content.append($("<li></li>").append($("<a></a>").html(value)
                                                                     .attr("href", "javascript:void(0)")
                                                                     .on("click" + DEFAULT_EVENT_DOMAIN, function (e) {
                                                                         if (e.which === 1) {
                                                                             e.preventDefault();
                                                                             var fullName = item.data("fullName"),
                                                                                 extension = fullName.substring(fullName.lastIndexOf("."));
                                                                             nameLabel.html($(e.target).html() + extension);
                                                                             postRename();
                                                                         }
                                                                     })));
                });
                editButton.popover({
                    html: true,
                    placement: "top",
                    container: target.container,
                    enabled: true,
                    content: content
                });
            }

            nameLabel.on("click" + DEFAULT_EVENT_DOMAIN, function (e) {
                e.preventDefault();
                if (!$("[" + CONTENTEDITABLE_ATTRIBUTE + "]", nameLabel).is("*") && target.options.predefinedFileNames.length > 0) {
                    editButton.popover("show");
                }
                beginEdit();
            });

            editButton.on("click" + DEFAULT_EVENT_DOMAIN, function (e) {
                e.preventDefault();
                beginEdit();
            });

            deleteButton.on("click" + DEFAULT_EVENT_DOMAIN, function (e) {
                e.preventDefault();
                deleteFile();
            });

            if (target.options.newToTop && oldItems.length > 0) {
                target.fileList.prepend(item);
            } else {
                target.fileList.append(item);
            }
            $(target).triggerHandler("filelistitemadd", item);

            function deleteFile() {
                target.options.switchItemState(item, "Normal");
                deleteButton.hide();
                progress.show();
                item.data("deleteJqXHR",
                    $.post(target.options.deleteUrl, { "fileName": file.fileName }, function (data, textStatus, jqXHR) {
                        if (jqXHR !== item.data("deleteJqXHR")) {
                            return;
                        }
                        item.removeData("deleteJqXHR");

                        if (data.success) {
                            onFileDeleteSuccess(jqXHR.item);
                        } else {
                            onFileDeleteError(jqXHR.item);
                        }
                    }, "json")
                    .error(function (jqXHR) { onFileDeleteError(jqXHR.item); })
                );
                item.data("deleteJqXHR").item = item;

                function onFileDeleteSuccess(item) {
                    target.options.switchItemState(item, "Disabled");
                    progress.css("visibility", "hidden");
                    window.setTimeout(function () {
                        item.fadeOut(target.options.animationDuration, function () {
                            item.remove();
                            $(target).triggerHandler("filelistitemremove", item);
                        });
                    }, target.options.autoClearFileListTimeout);
                }

                function onFileDeleteError(item) {
                    target.options.switchItemState(item, "Error");
                    deleteButton.show();
                    progress.hide();
                }
            }

            function beginEdit() {
                if ($("[" + CONTENTEDITABLE_ATTRIBUTE + "]", nameLabel).is("*")) {
                    return;
                }

                var fullName = item.data("fullName"),
                    fullNameWithoutExtension = fullName.substring(0, fullName.lastIndexOf(".")),
                    extension = fullName.substring(fullName.lastIndexOf(".")),
                    nameEditor = $("<div></div>");
                target.options.switchItemState(item, "Normal");
                nameEditor.html(fullNameWithoutExtension);
                nameLabel.html("")
                         .append(nameEditor.attr(CONTENTEDITABLE_ATTRIBUTE, true)
                                           .on("blur" + DEFAULT_EVENT_DOMAIN, function (e) {
                                               cancelEdit($(e.target));
                                           })
                                           .on("keydown" + DEFAULT_EVENT_DOMAIN, function (e) {
                                               switch (e.which) {
                                                   case 27:
                                                       e.preventDefault();
                                                       $(e.target).blur();
                                                       break;
                                                   case 13:
                                                       e.preventDefault();
                                                       comitEdit($(e.target));
                                                       break;

                                               }
                                           })
                                )
                         .after($("<span></span>").addClass(FLOAT_LEFT_CSS_CLASS).html(extension));
                if (target.options.urlFriendlyFileName) {
                    nameEditor.on("paste" + DEFAULT_EVENT_DOMAIN, function (e) {
                        window.setTimeout(function () {
                            nameEditor.html(PN.toUrlFriendly(nameEditor.html()));
                        }, 10);
                    });
                }
                nameEditor.focus();
                if (window.Modernizr && !Modernizr.touch && document.queryCommandEnabled("selectAll")) {
                    document.execCommand("selectAll", false, null);
                }
                $(target).triggerHandler("beginEdit", item);
            }

            function comitEdit(editor) {
                editor.off(DEFAULT_EVENT_DOMAIN)
                      .blur()
                      .removeAttr(CONTENTEDITABLE_ATTRIBUTE)
                      .html(target.options.urlFriendlyFileName ? PN.toUrlFriendly(editor.html()) : editor.html())
                      .parent().html(editor.text().trim() + editor.parent().next().html())
                               .next().remove();
                postRename();
                $(target).triggerHandler("comitEdit", item);
            }

            function cancelEdit(editor) {
                var name = PN.Components.RemoteFolder.formatFileName(file.fileName, true);
                editor.off(DEFAULT_EVENT_DOMAIN)
                      .blur()
                      .removeAttr(CONTENTEDITABLE_ATTRIBUTE)
                      .parent().html(name)
                               .next().remove();
                window.setTimeout(function () {
                    if (target.options.predefinedFileNames.length > 0 && !$(":focus").closest("span").is(nameLabel)) {
                        editButton.popover("hide");
                    }
                }, 100);
                $(target).triggerHandler("cancelEdit", item);
            }

            function postRename() {
                if (target.options.predefinedFileNames.length > 0) {
                    editButton.popover("hide");
                }
                target.options.switchItemState(item, "Disabled");
                item.data("renameJqXHR",
                    $.post(target.options.renameUrl, { "fileName": file.fileName, "newName": nameLabel.text().trim() }, function (data, textStatus, jqXHR) {
                        if (jqXHR !== item.data("renameJqXHR")) {
                            return;
                        }
                        item.removeData("renameJqXHR");

                        if (data.success) {
                            onFileRenameSuccess(jqXHR.item, data.newFileName);
                        } else {
                            onFileRenameError(jqXHR.item, data.fileNotFound);
                        }
                    }, "json")
                    .error(function (jqXHR) { onFileRenameError(jqXHR.item); })
                );
                item.data("renameJqXHR").item = item;

                function onFileRenameSuccess(item, newFileName) {
                    var name = PN.Components.RemoteFolder.formatFileName(newFileName, true),
                        fullName = PN.Components.RemoteFolder.formatFileName(newFileName, false);
                    target.options.switchItemState(item, "Normal");
                    file.fileName = newFileName;
                    item.data("fullName", fullName);
                    nameLabel.html(name);
                    $(target).triggerHandler("renamesuccess", item);
                }

                function onFileRenameError(item, fileNotFound) {
                    target.options.switchItemState(item, "Error");
                    if (fileNotFound === true) {
                        deleteButton.css("visibility", "hidden");
                        window.setTimeout(function () {
                            item.fadeOut(target.options.animationDuration, function () {
                                item.remove();
                                $(target).triggerHandler("filelistitemremove", item);
                            });
                        }, target.options.autoClearFileListTimeout);
                    } else {
                        var name = PN.Components.RemoteFolder.formatFileName(file.fileName, true);
                        nameLabel.html(name);
                    }
                }
            }
        }
    }

    function switchItemState(item, state) {
        var panel = $("." + PANEL_CSS_CLASS, item).removeClass(NORMAL_PANEL_CSS_CLASS)
                                                  .removeClass(SUCCESS_PANEL_CSS_CLASS)
                                                  .removeClass(ERROR_PANEL_CSS_CLASS)
                                                  .removeClass(DISABLED_PANEL_CSS_CLASS);
        switch (state) {
            case "Normal":
                panel.addClass(NORMAL_PANEL_CSS_CLASS);
                break;
            case "Success":
                panel.addClass(SUCCESS_PANEL_CSS_CLASS);
                break;
            case "Error":
                panel.addClass(ERROR_PANEL_CSS_CLASS);
                break;
            case "Disabled":
                panel.addClass(DISABLED_PANEL_CSS_CLASS);
                break;
            default:
                break;
        }
    }

    function getItemState(item) {
        var panel = $("." + PANEL_CSS_CLASS, item);
        return panel.hasClass(NORMAL_PANEL_CSS_CLASS) ? "Normal" :
            panel.hasClass(SUCCESS_PANEL_CSS_CLASS) ? "Success" :
            panel.hasClass(ERROR_PANEL_CSS_CLASS) ? "Error" :
            panel.hasClass(DISABLED_PANEL_CSS_CLASS) ? "Disabled" : null;

    }

})();
