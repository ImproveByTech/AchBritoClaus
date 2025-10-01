(function() {
  let queue = window._ptrack = window._ptrack || [];
  let accountId = "default_email";

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
          accountId = args[0];
          log("Account set to", accountId);
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
      // Requeue for retry
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

  // Safe DOMContentLoaded handling
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

  // Process any queue items that may have been added before script loaded
  processQueue();
})();
