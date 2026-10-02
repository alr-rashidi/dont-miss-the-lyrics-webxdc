// Reference Webxdc API implementation based on webxdc-test / webxdc standard
(function() {
  if (typeof window === 'undefined') return;

  // If already running in Delta Chat or a host that provides native webxdc with sendToChat, do not override
  if (window.webxdc && typeof window.webxdc.sendToChat === 'function') {
    return;
  }

  var updateListener = function(_) {};
  var updatesKey = "__xdcUpdatesKey__";

  window.addEventListener("storage", function(event) {
    if (event.key == null) {
      window.location.reload();
    } else if (event.key === updatesKey) {
      try {
        var updates = JSON.parse(event.newValue || "[]");
        var update = updates[updates.length - 1];
        if (update) {
          update.max_serial = updates.length;
          updateListener(update);
        }
      } catch (e) {
        console.warn("[Webxdc] storage parse error", e);
      }
    }
  });

  function getUpdates() {
    var updatesJSON = window.localStorage.getItem(updatesKey);
    return updatesJSON ? JSON.parse(updatesJSON) : [];
  }

  var params = new URLSearchParams(window.location.hash.substr(1));

  window.webxdc = {
    selfAddr: params.get("addr") || "device0@local.host",
    selfName: params.get("name") || "device0",

    setUpdateListener: function(cb, serial) {
      if (typeof serial === 'undefined') serial = 0;
      var updates = getUpdates();
      var maxSerial = updates.length;
      updates.forEach(function(update) {
        if (update.serial > serial) {
          update.max_serial = maxSerial;
          cb(update);
        }
      });
      updateListener = cb;
      return Promise.resolve();
    },

    getAllUpdates: function() {
      return Promise.resolve([]);
    },

    sendUpdate: function(update, description) {
      var updates = getUpdates();
      var serial = updates.length + 1;
      var _update = {
        payload: update.payload,
        summary: update.summary,
        info: update.info,
        serial: serial,
      };
      updates.push(_update);
      window.localStorage.setItem(updatesKey, JSON.stringify(updates));
      _update.max_serial = serial;
      updateListener(_update);
    },

    sendToChat: async function(content) {
      if (!content || (!content.file && !content.text)) {
        return Promise.reject(new Error("Error from sendToChat: either file or text need to be set"));
      }

      var blob_to_base64 = function(file) {
        var data_start = ";base64,";
        return new Promise(function(resolve, reject) {
          var reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = function() {
            var data = reader.result;
            if (typeof data === 'string') {
              var idx = data.indexOf(data_start);
              resolve(idx !== -1 ? data.slice(idx + data_start.length) : data);
            } else {
              resolve("");
            }
          };
          reader.onerror = function() { reject(reader.error); };
        });
      };

      var base64Content = "";
      var fileBlob = null;

      if (content.file) {
        if (!content.file.name) {
          return Promise.reject(new Error("file name is missing"));
        }

        var keys = Object.keys(content.file).filter(function(key) {
          return ["blob", "base64", "plainText"].indexOf(key) !== -1;
        });

        if (keys.length > 1) {
          return Promise.reject(new Error("you can only set one of blob, base64 or plainText"));
        }

        if (content.file.blob instanceof Blob || (content.file.blob && typeof content.file.blob.slice === 'function')) {
          fileBlob = content.file.blob;
          try {
            base64Content = await blob_to_base64(content.file.blob);
          } catch (e) {
            console.warn("Could not convert blob to base64 in mock sendToChat:", e);
          }
        } else if (typeof content.file.base64 === "string") {
          base64Content = content.file.base64;
          try {
            var cleanB64 = content.file.base64.replace(/\s/g, '');
            var binary = atob(cleanB64);
            var len = binary.length;
            var buffer = new ArrayBuffer(len);
            var bytes = new Uint8Array(buffer);
            for (var i = 0; i < len; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            fileBlob = new Blob([buffer], { type: "application/octet-stream" });
          } catch (e) {
            console.warn("Base64 to blob conversion error:", e);
          }
        } else if (typeof content.file.plainText === "string") {
          fileBlob = new Blob([content.file.plainText], { type: "text/plain;charset=utf-8" });
          try {
            base64Content = await blob_to_base64(fileBlob);
          } catch (e) {
            console.warn("PlainText to base64 conversion warning:", e);
          }
        } else {
          return Promise.reject(new Error("data is not set or wrong format in sendToChat"));
        }
      }

      console.log("[Webxdc sendToChat]", {
        text: content.text,
        fileName: content.file ? content.file.name : undefined,
        bytes: fileBlob ? fileBlob.size : (base64Content ? base64Content.length : 0)
      });

      // When tested in browser / dev / preview, trigger download of the created file
      if (content.file && fileBlob) {
        try {
          var url = URL.createObjectURL(fileBlob);
          var element = document.createElement("a");
          element.setAttribute("href", url);
          element.setAttribute("download", content.file.name);
          element.style.display = "none";
          document.body.appendChild(element);
          element.click();
          setTimeout(function() {
            if (element.parentNode) document.body.removeChild(element);
            URL.revokeObjectURL(url);
          }, 2000);
        } catch (err) {
          console.warn("Browser test download fallback error:", err);
        }
      }

      return Promise.resolve();
    },

    importFiles: function(filters) {
      var element = document.createElement("input");
      element.type = "file";
      element.accept = [
        ...(filters.extensions || []),
        ...(filters.mimeTypes || []),
      ].join(",");
      element.multiple = filters.multiple || false;
      var promise = new Promise(function(resolve) {
        element.onchange = function() {
          var files = Array.from(element.files || []);
          if (element.parentNode) document.body.removeChild(element);
          resolve(files);
        };
      });
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      return promise;
    }
  };
})();
