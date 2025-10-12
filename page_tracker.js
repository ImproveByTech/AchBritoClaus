(function() {
  let queue = window._ptrack = window._ptrack || [];
  let accountId = "default_email";
  let userId = "unknown_id";
  let email = "unknown_email";

  // Utility: safe logging
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

  // Process queue items
  function processQueue() {
    const failed = [];
    while (queue.length) {
      const [method, ...args] = queue.shift();
      log("Processing queue item", method, args);
      try {
        if (method === "setAccount") {
          const acc = args[0];
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

        } else if (method === "trackProduct") {
          sendProductData(args[0]);

        } else {
          log("Unknown method", method);
        }

      } catch (e) {
        log("Error processing queue item, will retry", method, e);
        failed.push([method, ...args]);
      }
    }
    if (failed.length) queue.push(...failed);  // retry failed items
  }

  // Send product data to server
  function sendProductData(data) {
    if (!data.id) {
      log("Product tracking requires at least an ID", data);
      return;
    }

    const payload = {
      account: accountId,
      userId: userId,
      email: email,
      timestamp: new Date().toISOString(),
      ...data
    };

    log("Sending product data", payload);

    fetch("https://achbrito-app-b9d30e46c7a5.herokuapp.com/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => log("Server response", res))
    .catch(e => {
      log("Tracking error, will retry", e);
      queue.push(["trackProduct", data]);
    });
  }

  // Override push to auto-process queue
  const originalPush = queue.push.bind(queue);
  queue.push = function(...items) {
    const result = originalPush(...items);
    processQueue();
    return result;
  };

  // Auto-track product from DOM if attributes present
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

  // Process any existing queue items
  processQueue();
})();
