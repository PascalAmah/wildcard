import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

// GSAP is available globally from this point — the Flip plugin
// is registered at import time via the side effect in gsapConfig.ts
// which is imported by components and hooks that use it.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
