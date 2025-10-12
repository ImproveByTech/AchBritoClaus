(function() {
  let queue = window._ptrack = window._ptrack || [];
  let accountId = "default_email";
  let userId = "unknown_id";
  let email = "unknown_email";

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

  // --- Process queue items ---
  function processQueue() {
    const failed = [];
    while (queue.length) {
      const [method, ...args] = queue.shift();
      log("Processing queue item", method, args);
      try {
        if (method === "setAccount") {
          handleSetAccount(args[0]);
        } else if (method === "trackProduct") {
          sendTrackData("product", args[0]);
        } else if (method === "trackPageView") {
          sendTrackData("pageview", args[0]);
        } else if (method === "trackCart") {
          sendTrackData("cart", args[0]);
        } else if (method === "trackLogin") {
          sendTrackData("login", args[0]);
        } else {
          log("Unknown method", method);
        }
      } catch (e) {
        log("Error processing queue item, will retry", method, e);
        failed.push([method, ...args]);
      }
    }
    if (failed.length) queue.push(...failed); // retry failed items
  }

  // --- Handle account setup ---
  function handleSetAccount(acc) {
    if (typeof acc === "string") {
      userId = acc;
      email = "unknown_email";
      accountId = acc;
    } else if (typeof acc === "object" && acc !== null) {
      userId = acc.id || "unknown_id";
      email = acc.email || "unknown_email";
      accountId = email;
    } else {
      userId = "unknown_id";
      email = "unknown_email";
    }
    log("Account/user set", { accountId, userId, email });
  }

  // --- Generic sender (for all event types) ---
  function sendTrackData(type, data = {}) {
    const payload = {
      type,
      account: accountId,
      userId,
      email,
      timestamp: new Date().toISOString(),
      ...data
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

  // --- Helpers ---
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // --- Queue override ---
  const originalPush = queue.push.bind(queue);
  queue.push = function(...items) {
    const result = originalPush(...items);
    processQueue();
    return result;
  };

  // --- Auto-track product from DOM ---
  function initProductTracking() {
    const productEl = document.querySelector("[data-track-product]");
    if (!productEl) return;
    const data = {
      id: productEl.dataset.productId,
      name: productEl.dataset.productName,
      price: productEl.dataset.productPrice,
      category: productEl.dataset.productCategory
    };
    if (data.id) _ptrack.push(["trackProduct", data]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductTracking);
  } else {
    initProductTracking();
  }

  processQueue();
})();
