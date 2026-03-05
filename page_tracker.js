(function() {
  let queue = window._ptrack = window._ptrack || [];

  // --- Logging ---
  function log(msg, ...args) {
    console.log("[PageTracker]", msg, ...args);
    try {
      fetch("https://achbrito-app-b9d30e46c7a5.herokuapp.com/js-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          args: args,
          timestamp: new Date().toISOString()
        })
      }).catch(e => console.warn("Log server unreachable", e));
    } catch (e) {
      console.warn("Logging failed", e);
    }
  }

  // --- Generic sender (for all event types) ---
  function sendTrackData(type, data = {}) {
    // Validação do ID do produto
    if (type === "product" && (!data.id || data.id.trim() === "")) {
      log("Product tracking skipped: missing product ID", data);
      return;
    }

    const userId = data.userId || "unknown_id";
    const email = data.email || "unknown_email";
    const accountId = email !== "unknown_email" ? email : "default_email";

    const payload = {
      type,
      account: accountId,
      userId: userId,
      email: email,
      timestamp: new Date().toISOString(),
      ...data // Injeta o resto (id do produto, preço, etc.)
    };

    log(`Sending ${type} data`, payload);

    fetch("https://achbrito-app-b9d30e46c7a5.herokuapp.com/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => log("Server response", res))
    .catch(e => {
      log(`${type} tracking error, will retry`, e);
      queue.push([`track${capitalize(type)}`, data]);
    });
  }

  // --- Queue processor ---
  function processQueue() {
    const failed = [];
    while (queue.length) {
      const [method, ...args] = queue.shift();
      log("Processing queue item", method, args);
      try {
        // Removemos o setAccount daqui. Só processamos eventos reais.
        if (method === "trackProduct") {
          sendTrackData("product", args[0]);
        } else if (method === "trackPageView") {
          sendTrackData("pageview", args[0]);
        } else if (method === "trackCart") {
          sendTrackData("cart", args[0]);
        } else if (method === "trackLogin") {
          sendTrackData("login", args[0]);
        } else if (method === "setAccount") {
          log("Ignored setAccount - System is now stateless");
        } else {
          log("Unknown method", method);
        }
      } catch (e) {
        log("Error processing queue item, will retry", method, e);
        failed.push([method, ...args]);
      }
    }
    if (failed.length) queue.push(...failed);
  }

  // --- Helpers ---
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // --- Override push to auto-process queue ---
  const originalPush = queue.push.bind(queue);
  queue.push = function(...items) {
    const result = originalPush(...items);
    processQueue();
    return result;
  };

  // --- Process any queued items immediately ---
  processQueue();

})();