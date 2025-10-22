(function () {
  function makePlugin(bunny, definePlugin) {
    return definePlugin({
      start() {
        this.unreg = bunny.api.commands.registerCommand({
          name: "extractmsgs",
          description: "Export current channel messages to JSON (scroll up first).",
          execute: async (_args, _ctx) => {
            try {
              const channelId = bunny.metro?.common?.channels?.getChannelId?.();
              if (!channelId) return { content: "No channel open.", ephemeral: true };

              const findByProps = bunny.metro?.findByProps;
              const MessagesStore =
                findByProps?.("getRawMessages") ||
                findByProps?.("getMessages") ||
                findByProps?.("MessageStore");

              const msgs =
                MessagesStore?.getRawMessages?.(channelId) ||
                MessagesStore?.getMessages?.(channelId);

              const iterable = msgs?.values ? Array.from(msgs.values()) : (Array.isArray(msgs) ? msgs : []);
              if (!iterable.length) return { content: "No messages loaded. Scroll up.", ephemeral: true };

              const arr = iterable
                .map((m) => ({
                  id: m?.id,
                  content: m?.content || "[No text]",
                  author: m?.author?.username || m?.author?.id || "Deleted Account",
                  timestamp: m?.timestamp,
                  edited: m?.editedTimestamp ? new Date(m.editedTimestamp).toLocaleString() : null,
                  attachments: (m?.attachments || []).map((a) => ({ name: a?.filename, url: a?.url })),
                }))
                .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));

              const data = JSON.stringify(arr, null, 2);
              const fileName = `${String(channelId).slice(-8)}_${Date.now()}.json`;
              await bunny.api.fs.writeFile(`message_exports/${fileName}`, data);

              try {
                const assetId = bunny.api.assets?.findAssetId?.("Check");
                bunny.ui?.toasts?.showToast?.(`Exported ${arr.length} msgs: ${fileName}`, assetId);
              } catch {}

              return { content: `✅ Exported ${arr.length} messages. File: ${fileName}`, ephemeral: true };
            } catch (e) {
              return { content: `❌ Failed: ${e?.message || String(e)}`, ephemeral: true };
            }
          },
        });
      },
      stop() {
        this.unreg?.();
      },
    });
  }

  this.plugin = function (bunny, definePlugin) {
    return makePlugin(bunny, definePlugin);
  };
})();
