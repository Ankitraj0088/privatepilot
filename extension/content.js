chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "GET_PRIVATEPILOT_TOKEN") {
    window.postMessage({
      type: "PRIVATEPILOT_EXTENSION_REQUEST"
    }, "*");

    const handler = (event) => {
      if (event.source !== window) return;

      if (event.data?.type !== "PRIVATEPILOT_EXTENSION_TOKEN") {
        return;
      }

      window.removeEventListener("message", handler);

      sendResponse({
        token: event.data.token || null
      });
    };

    window.addEventListener("message", handler);
    return true;
  }


  if (message.type === "EXTRACT_PAGE") {
    const text = document.body?.innerText || "";

    sendResponse({
      type: "extract",
      status: "completed",
      url: location.href,
      title: document.title,
      text: text.slice(0, 12000)
    });

    return true;
  }


  if (message.type === "SEARCH_PAGE") {
    const query = message.query || "";

    sendResponse({
      type: "search",
      status: "completed",
      query,
      url: location.href,
      pageTitle: document.title
    });

    return true;
  }


  if (message.type === "SCROLL_PAGE") {
    window.scrollBy({
      top: window.innerHeight * 0.8,
      behavior: "smooth"
    });

    sendResponse({
      type: "scroll",
      status: "completed"
    });

    return true;
  }


  if (message.type === "CLICK_TEXT") {
    const target = (message.text || "").toLowerCase();

    const elements = [...document.querySelectorAll(
      "button, a, input[type='button'], input[type='submit'], [role='button']"
    )];

    const element = elements.find(el =>
      (el.innerText || el.value || "")
        .trim()
        .toLowerCase()
        .includes(target)
    );

    if (!element) {
      sendResponse({
        status: "failed",
        error: `Could not find clickable element: ${message.text}`
      });
      return true;
    }

    element.click();

    sendResponse({
      status: "completed",
      action: "click",
      text: message.text
    });

    return true;
  }


  if (message.type === "TYPE_TEXT") {
    const text = message.text || "";

    const input = document.querySelector(
      "input:not([type='hidden']), textarea"
    );

    if (!input) {
      sendResponse({
        status: "failed",
        error: "Could not find an input field."
      });
      return true;
    }

    input.focus();
    input.value = text;

    input.dispatchEvent(new Event("input", {
      bubbles: true
    }));

    input.dispatchEvent(new Event("change", {
      bubbles: true
    }));

    sendResponse({
      status: "completed",
      action: "type",
      text
    });

    return true;
  }

});
