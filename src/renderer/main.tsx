import React from "react";
import { createRoot } from "react-dom/client";
import "remixicon/fonts/remixicon.css";
import "./styles/globals.css";
import "./app.css";
import { App } from "./App";
import { ensureBrowserPreviewBridge } from "./bootstrap";

// Electron supplies window.edunex from preload. A direct Vite tab does not,
// so give browser previews a local fixture bridge without affecting packaged
// boot or replacing the real IPC bridge.
ensureBrowserPreviewBridge(window, import.meta.env.DEV);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
