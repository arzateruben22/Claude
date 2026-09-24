/* Lumevina — save a file the page made (a CSV, a calendar file)
 *
 * On the real website a file downloads the usual way. Inside a claude.ai
 * preview a page can't download on its own: the file goes through the
 * viewer's "downloads" permission, which shows the file and asks before
 * saving. That route takes CSV, text and similar files, but not calendar
 * (.ics) files, so calendar buttons check `canSave("ics")` and offer
 * Google Calendar instead.
 *
 *   LumevinaSave.file(name, text, mime) → Promise: resolves when saved,
 *                                        rejects { code, message }
 *   LumevinaSave.canSave(ext)          → false only for types a preview refuses
 *   LumevinaSave.inPreview()           → running inside a claude.ai preview
 */
(function () {
  "use strict";

  var PREVIEW_TYPES = ["csv", "txt", "json", "md", "pdf", "html", "zip", "xlsx", "png", "jpg", "svg"];
  var inPreview = function () { return !!(window.claude && typeof window.claude.use === "function"); };

  var ns = null;
  var viewer = function () {
    if (!ns) {
      ns = window.claude.use("downloads").then(function (d) { return d; }, function () { return null; });
    }
    return ns;
  };

  var direct = function (name, data, mime) {
    var url = URL.createObjectURL(new Blob([data], { type: mime || "application/octet-stream" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return Promise.resolve("saved");
  };

  var MESSAGES = {
    declined: "",                                               /* they said no: say nothing */
    rate_limited: "One save is already waiting. Try again in a moment.",
    rejected_extension: "This file type can't be saved here.",
    too_large: "This file is too large to save here."
  };

  var file = function (name, data, mime) {
    if (!inPreview()) return direct(name, data, mime);
    return viewer().then(function (d) {
      if (!d) return Promise.reject({ code: "unavailable", message: "Saving files isn't available in this view." });
      return d.save({ filename: name, data: data }).then(function (r) { return r.status; }, function (err) {
        var code = (err && err.code) || "unavailable";
        return Promise.reject({ code: code, message: code in MESSAGES ? MESSAGES[code] : "Saving files isn't available in this view." });
      });
    });
  };

  var canSave = function (ext) { return !inPreview() || PREVIEW_TYPES.indexOf(String(ext).toLowerCase()) !== -1; };

  window.LumevinaSave = { file: file, canSave: canSave, inPreview: inPreview };
})();
