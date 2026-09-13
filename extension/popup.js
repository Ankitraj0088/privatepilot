const API_URL = "https://privatepilot.onrender.com";

const taskInput = document.getElementById("task");
const runButton = document.getElementById("run");
const status = document.getElementById("status");

runButton.addEventListener("click", async () => {
  const task = taskInput.value.trim();

  if (!task) {
    status.textContent = "Enter a task first.";
    return;
  }

  runButton.disabled = true;

  try {
    status.textContent = "Finding browser tab...";

    // IMPORTANT:
    // Use lastFocusedWindow instead of currentWindow.
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });

    if (!tabs || !tabs.length || !tabs[0].id) {
      throw new Error("No active browser tab.");
    }

    const activeTab = tabs[0];

    console.log("Active browser tab:", activeTab);

    // Find the PrivatePilot localhost tab to retrieve the login token.
    const allTabs = await chrome.tabs.query({
      lastFocusedWindow: true
    });

    const privatePilotTab = allTabs.find(
      tab =>
        tab.url &&
        (
          tab.url.startsWith("http://localhost:5173") ||
          tab.url.startsWith("http://127.0.0.1:5173")
        )
    );

    let token = null;

    if (privatePilotTab && privatePilotTab.id) {
      status.textContent = "Getting PrivatePilot session...";

      try {
        const tokenResponse = await chrome.tabs.sendMessage(
          privatePilotTab.id,
          {
            type: "GET_PRIVATEPILOT_TOKEN"
          }
        );

        token = tokenResponse?.token || null;
      } catch (error) {
        console.warn("Could not get token from PrivatePilot tab:", error);
      }
    }

    // Fallback to extension storage.
    if (!token) {
      const stored = await chrome.storage.local.get([
        "access_token"
      ]);

      token = stored.access_token || null;
    }

    if (!token) {
      throw new Error(
        "Open the logged-in PrivatePilot page first."
      );
    }

    await chrome.storage.local.set({
      access_token: token
    });

    status.textContent = "Creating plan...";

    const response = await fetch(`${API_URL}/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        task
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Planner returned HTTP ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();

    console.log("PrivatePilot plan:", data.plan);

    status.textContent = "Executing...";

    // Send the plan to the background service worker.
    const result = await chrome.runtime.sendMessage({
      type: "RUN_PLAN",
      plan: data.plan,
      tabId: activeTab.id
    });

    if (!result?.ok) {
      throw new Error(
        result?.error || "Browser execution failed."
      );
    }

    console.log(
      "PrivatePilot execution result:",
      result.result
    );

    status.textContent = "Task completed.";

  } catch (error) {
    console.error("PrivatePilot error:", error);
    status.textContent = error.message;
  } finally {
    runButton.disabled = false;
  }
});
