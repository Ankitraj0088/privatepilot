chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "RUN_PLAN") return;

  runPlan(message.plan)
    .then(result => sendResponse({ ok: true, result }))
    .catch(error => sendResponse({
      ok: false,
      error: error.message
    }));

  return true;
});

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  if (!tabs.length || !tabs[0].id) {
    throw new Error("No active browser tab.");
  }

  return tabs[0];
}

async function runPlan(plan) {
  const results = [];

  for (const action of plan.actions || []) {
    const result = await executeAction(action);
    results.push(result);
  }

  return results;
}

async function executeAction(action) {
  const tab = await getActiveTab();

  switch (action.type) {

    case "navigate":
      if (!action.url) {
        throw new Error("Navigate action has no URL.");
      }

      await chrome.tabs.update(tab.id, {
        url: action.url
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        action: "navigate",
        status: "completed",
        url: action.url
      };


    case "type":
    case "type_text":
      return await chrome.tabs.sendMessage(tab.id, {
        type: "TYPE_TEXT",
        text: action.text || action.value || ""
      });


    case "click":
    case "click_text":
      return await chrome.tabs.sendMessage(tab.id, {
        type: "CLICK_TEXT",
        text: action.text || action.target || ""
      });


    case "wait":
      await new Promise(resolve =>
        setTimeout(resolve, (action.seconds || 1) * 1000)
      );

      return {
        action: "wait",
        status: "completed",
        seconds: action.seconds || 1
      };

    case "scroll":
      return await chrome.tabs.sendMessage(tab.id, {
        type: "SCROLL_PAGE"
      });


    case "extract":
      return await chrome.tabs.sendMessage(tab.id, {
        type: "EXTRACT_PAGE",
        target: action.target || ""
      });


    case "search":
      return await chrome.tabs.sendMessage(tab.id, {
        type: "SEARCH_PAGE",
        query: action.query || ""
      });


    default:
      return {
        action: action.type,
        status: "unsupported"
      };
  }
}
