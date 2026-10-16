import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installIdleLogout, verifyStoredSession } from "./lib/api-session";

// Log out sessions left idle (without "Remember me") for 30+ minutes.
installIdleLogout();

// Check any saved login with the backend before the first render, so an
// expired token or a deactivated account goes straight to the login page.
verifyStoredSession().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});

// Installable app: register the service worker in production builds only
// (in development it would cache files you're still editing).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* app still works without it, just not installable/offline */
    });
  });
}
