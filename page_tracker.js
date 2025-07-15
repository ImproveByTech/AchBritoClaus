(function() {
  let queue = window._ptrack = window._ptrack || [];
  let accountId = "unknown_email";
  let userId = "unknown_id";
  
  function processQueue() {
    while (queue.length) {
      const [method, ...args] = queue.shift();
      if (method === "setAccount") {
        const acc = args[0];
        if (typeof acc === "string") {
          userId = acc;
          email = "unknown_email";
        } else if (typeof acc === "object" && acc !== null) {
          userId = acc.id || "unknown_id";
          email = acc.email || "unknown_email";
        } else {
    userId = "unknown_id";
    email = "unknown_email";
  }
}

      else if (method === "trackProduct") {
        sendProductData(args[0]);
      }
    }
  }
  
  function sendProductData(data) {
    if (!data.id) {
      console.warn("Product tracking requires at least an ID");
      return;
    }
    
    const payload = {
      account: accountId,
      userId: userId,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    fetch("http://185.202.223.81:5002/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(e => console.error("Tracking error:", e));
  }
  
  // Process existing queue and override push to process immediately
  processQueue();
  queue.push = function(item) {
    Array.prototype.push.apply(this, arguments);
    processQueue();
    return this.length;
  };
  
  // Auto-track if data attributes are present
  document.addEventListener("DOMContentLoaded", () => {
    const productEl = document.querySelector("[data-track-product]");
    if (productEl) {
      const data = {
        id: productEl.dataset.productId,
        name: productEl.dataset.productName,
        price: productEl.dataset.productPrice,
        category: productEl.dataset.productCategory
      };
      if (data.id) _ptrack.push(["trackProduct", data]);
    }
  });
})();