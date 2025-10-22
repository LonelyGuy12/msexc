// Hermes-safe, no async/await or optional chaining. Expose `var plugin` for Kettu loader.
function safeGet(obj, path){
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (!obj) return undefined;
      obj = obj[parts[i]];
    }
    return obj;
}

function makePlugin(bunny, definePlugin){
  return definePlugin({
    start: function(){
      try {
        var findAssetId0 = (bunny && bunny.api && bunny.api.assets && bunny.api.assets.findAssetId) || function(){ return undefined; };
        var showToast0 = bunny && bunny.ui && bunny.ui.toasts && bunny.ui.toasts.showToast;
        if (showToast0) showToast0("Message Extractor loaded", findAssetId0("Check"));
      } catch (e) {}
      var unregister = bunny.api.commands.registerCommand({
        name: "extractmsgs",
        description: "Export current channel messages to JSON (scroll up first).",
        shouldHide: function(){ return false; },
        execute: function(_args, _ctx){
          try {
            var channels = safeGet(bunny, "metro.common.channels");
            var getChannelId = channels && channels.getChannelId;
            var channelId = getChannelId ? getChannelId() : null;
            if (!channelId) return { content: "No channel open.", ephemeral: true };

            var findByProps = safeGet(bunny, "metro.findByProps");
            var MessagesStore = findByProps && (findByProps("getRawMessages") || findByProps("getMessages") || findByProps("MessageStore"));

            var msgs = MessagesStore && (
              (MessagesStore.getRawMessages && MessagesStore.getRawMessages(channelId)) ||
              (MessagesStore.getMessages && MessagesStore.getMessages(channelId))
            );

            var iterable = [];
            if (msgs) {
              if (typeof msgs.values === "function") iterable = Array.from(msgs.values());
              else if (Array.isArray(msgs)) iterable = msgs.slice();
            }

            if (!iterable.length) return { content: "No messages loaded. Scroll up.", ephemeral: true };

            var arr = iterable
              .map(function(m){
                return {
                  id: m && m.id,
                  content: (m && m.content) || "[No text]",
                  author: (m && m.author && (m.author.username || m.author.id)) || "Deleted Account",
                  timestamp: m && m.timestamp,
                  edited: (m && m.editedTimestamp) ? new Date(m.editedTimestamp).toLocaleString() : null,
                  attachments: (m && m.attachments ? m.attachments.map(function(a){ return { name: a && a.filename, url: a && a.url }; }) : [])
                };
              })
              .sort(function(a, b){ return +new Date(a.timestamp) - +new Date(b.timestamp); });

            var data = JSON.stringify(arr, null, 2);
            var fileName = String(channelId).slice(-8) + "_" + Date.now() + ".json";

            return bunny.api.fs.writeFile("message_exports/" + fileName, data)
              .then(function(){
                try {
                  var findAssetId = safeGet(bunny, "api.assets.findAssetId");
                  var assetId = findAssetId ? findAssetId("Check") : undefined;
                  var showToast = safeGet(bunny, "ui.toasts.showToast");
                  if (showToast) showToast("Exported " + arr.length + " msgs: " + fileName, assetId);
                } catch (e) {}

                return { content: "✅ Exported " + arr.length + " messages. File: " + fileName, ephemeral: true };
              })
              .catch(function(e){
                return { content: "❌ Failed: " + (e && e.message ? e.message : String(e)), ephemeral: true };
              });
          } catch (e) {
            return { content: "❌ Failed: " + (e && e.message ? e.message : String(e)), ephemeral: true };
          }
        }
      });
      this.unreg = unregister;
    },
    stop: function(){ if (this.unreg) this.unreg(); }
  });
}

// Kettu's loader evals the file and returns `plugin?.default ?? plugin`.
// So we must define a local `var plugin` symbol, not `this.plugin`.
try { console.log("[MessageExtractor] script evaluated"); } catch (e) {}
if (typeof globalThis !== 'undefined') { try { globalThis.__ME_EVAL__ = Date.now(); } catch (e) {} }
var plugin = function(bunny, definePlugin){
  try { console.log("[MessageExtractor] factory invoked"); } catch (e) {}
  // Add a very simple ping command too
  var instance = makePlugin(bunny, definePlugin);
  try {
    var unping = bunny.api.commands.registerCommand({
      name: "extractping",
      description: "Ping from Message Extractor",
      shouldHide: function(){ return false; },
      execute: function(){ return { content: "Message Extractor is active.", ephemeral: true }; }
    });
    // ensure it gets cleaned if stop() is called later
    var oldStop = instance.stop;
    instance.stop = function(){ try { if (unping) unping(); } catch(e){}; if (oldStop) oldStop(); };
    try { console.log("[MessageExtractor] registered /extractping"); } catch (e) {}
  } catch (e) { try { console.log("[MessageExtractor] failed to register /extractping", e); } catch(_){} }
  return instance;
};
