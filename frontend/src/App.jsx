import React, { useState } from "react";

const API_URL = "http://localhost:8000";

function installExtensionBridge() {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data?.type !== "PRIVATEPILOT_EXTENSION_REQUEST") {
      return;
    }

    const token = localStorage.getItem("privatepilot_token");

    window.postMessage({
      type: "PRIVATEPILOT_EXTENSION_TOKEN",
      token: token || null
    }, "*");
  });
}

installExtensionBridge();

function App() {
  const [page, setPage] = useState("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [task, setTask] = useState("");
  const [token, setToken] = useState(
    localStorage.getItem("privatepilot_token")
  );
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("privatepilot_user") || "null")
  );
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function authenticate(mode) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      localStorage.setItem(
        "privatepilot_token",
        data.access_token
      );

      localStorage.setItem(
        "privatepilot_user",
        JSON.stringify(data.user)
      );

      setToken(data.access_token);
      setUser(data.user);
      setPage("dashboard");

    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks() {
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/tasks`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load tasks.");
      }

      setTasks(data.tasks || []);

    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitTask() {
    if (!task.trim()) {
      setMessage("Please enter a browser task.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            task
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Task submission failed."
        );
      }

      setMessage(
        `Task #${data.task.id} saved successfully.`
      );

      setTask("");
      loadTasks();

    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function openDashboard() {
    if (token) {
      setPage("dashboard");
      loadTasks();
    } else {
      setPage("login");
    }
  }

  function logout() {
    localStorage.removeItem("privatepilot_token");
    localStorage.removeItem("privatepilot_user");

    setToken(null);
    setUser(null);
    setTasks([]);
    setPage("home");
  }

  if (page === "login" || page === "signup") {
    const isLogin = page === "login";

    return (
      <div className="auth-page">
        <div className="auth-card">

          <button
            className="back-button"
            onClick={() => setPage("home")}
          >
            ← Back
          </button>

          <div className="brand">
            <span className="brand-mark">P</span>
            <span>PrivatePilot</span>
          </div>

          <h1>
            {isLogin
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p className="muted">
            {isLogin
              ? "Sign in to continue to your browser agent."
              : "Start using your privacy-first browser agent."}
          </p>

          <label>Email</label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {message && (
            <div className="error">
              {message}
            </div>
          )}

          <button
            className="primary full"
            disabled={loading}
            onClick={() =>
              authenticate(
                isLogin ? "login" : "signup"
              )
            }
          >
            {loading
              ? "Please wait..."
              : isLogin
                ? "Sign in"
                : "Create account"}
          </button>

          <p className="switch-text">
            {isLogin
              ? "Don't have an account?"
              : "Already have an account?"}

            <button
              className="link-button"
              onClick={() => {
                setMessage("");
                setPage(
                  isLogin
                    ? "signup"
                    : "login"
                );
              }}
            >
              {isLogin ? " Sign up" : " Sign in"}
            </button>
          </p>

        </div>
      </div>
    );
  }

  if (page === "dashboard") {
    return (
      <div className="dashboard">

        <nav className="navbar">

          <div className="brand">
            <span className="brand-mark">P</span>
            <span>PrivatePilot</span>
          </div>

          <div className="nav-right">

            <span>{user?.email}</span>

            <button
              className="secondary"
              onClick={logout}
            >
              Log out
            </button>

          </div>

        </nav>

        <main className="dashboard-main">

          <div className="dashboard-heading">

            <span className="eyebrow">
              PRIVATE BROWSER AGENT
            </span>

            <h1>
              What should your browser do?
            </h1>

            <p>
              Give the agent a task in natural
              language.
            </p>

          </div>

          <div className="task-card">

            <textarea
              value={task}
              onChange={(e) =>
                setTask(e.target.value)
              }
              placeholder='Example: "Open the ISRO website and find the latest mission information."'
            />

            <div className="task-footer">

              <span className="privacy-note">
                🔒 Authentication + database
                protection active.
              </span>

              <button
                className="primary"
                disabled={loading}
                onClick={submitTask}
              >
                {loading
                  ? "Saving..."
                  : "Run task →"}
              </button>

            </div>

          </div>

          {message && (
            <div className="success">
              {message}
            </div>
          )}

          <section className="history">

            <div className="history-header">
              <h2>Task history</h2>

              <button
                className="secondary"
                onClick={loadTasks}
              >
                Refresh
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="empty">
                No tasks yet.
              </div>
            ) : (
              tasks.map((item) => (
                <div
                  className="task-row"
                  key={item.id}
                >
                  <div>
                    <strong>
                      #{item.id}
                    </strong>

                    <p>
                      {item.task}
                    </p>
                  </div>

                  <span className="task-status">
                    {item.status}
                  </span>
                </div>
              ))
            )}

          </section>

          <section className="features">

            <div className="feature">
              <div className="feature-icon">
                🔐
              </div>

              <h3>Secure authentication</h3>

              <p>
                Passwords are hashed before
                being stored in the database.
              </p>
            </div>

            <div className="feature">
              <div className="feature-icon">
                🗄️
              </div>

              <h3>Persistent history</h3>

              <p>
                Your submitted tasks survive
                server restarts.
              </p>
            </div>

            <div className="feature">
              <div className="feature-icon">
                🎫
              </div>

              <h3>JWT protected</h3>

              <p>
                Task APIs require an authenticated
                access token.
              </p>
            </div>

          </section>

        </main>
      </div>
    );
  }

  return (
    <div className="landing">

      <nav className="navbar landing-nav">

        <div className="brand">
          <span className="brand-mark">P</span>
          <span>PrivatePilot</span>
        </div>

        <div className="nav-actions">

          <button
            className="nav-link"
            onClick={() => setPage("login")}
          >
            Sign in
          </button>

          <button
            className="primary small"
            onClick={() => setPage("signup")}
          >
            Get started
          </button>

        </div>

      </nav>

      <main className="hero">

        <div className="privacy-pill">
          <span>●</span>
          Privacy-first browser automation
        </div>

        <h1>
          Your browser.
          <br />
          <span>Your instructions.</span>
        </h1>

        <p className="hero-description">
          A lightweight AI browser agent that
          understands your goal, performs browser
          tasks, and protects sensitive information
          locally.
        </p>

        <div className="hero-actions">

          <button
            className="primary large"
            onClick={() => setPage("signup")}
          >
            Start building →
          </button>

          <button
            className="secondary large"
            onClick={() =>
              document
                .getElementById("how")
                ?.scrollIntoView({
                  behavior: "smooth"
                })
            }
          >
            How it works
          </button>

        </div>

        <div className="browser-preview">

          <div className="browser-top">

            <div className="browser-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div className="address">
              🔒 privatepilot.local
            </div>

          </div>

          <div className="browser-content">

            <div className="preview-label">
              AI BROWSER AGENT
            </div>

            <h2>
              Find information without giving
              away everything.
            </h2>

            <div className="preview-task">
              <span>›</span>
              Find the latest information on
              this webpage
            </div>

            <div className="preview-status">
              <span className="status-dot"></span>
              Local privacy layer active
            </div>

          </div>

        </div>

      </main>

      <section id="how" className="how">

        <div className="section-heading">

          <span className="eyebrow">
            HOW IT WORKS
          </span>

          <h2>
            AI where you need it.
            Privacy where it matters.
          </h2>

        </div>

        <div className="steps">

          <div className="step">
            <span>01</span>

            <h3>Give a task</h3>

            <p>
              Describe what you want your
              browser to accomplish using
              normal language.
            </p>
          </div>

          <div className="step">
            <span>02</span>

            <h3>Protect locally</h3>

            <p>
              Sensitive browser information
              can be detected and protected
              before leaving your device.
            </p>
          </div>

          <div className="step">
            <span>03</span>

            <h3>Execute</h3>

            <p>
              The agent reasons about the task
              and interacts with webpages to
              complete it.
            </p>
          </div>

        </div>

      </section>

      <footer>

        <div className="brand">
          <span className="brand-mark">P</span>
          <span>PrivatePilot</span>
        </div>

        <span>
          Privacy-first browser AI
        </span>

      </footer>

    </div>
  );
}

export default App;
