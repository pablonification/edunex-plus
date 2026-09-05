import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "remixicon/fonts/remixicon.css";
import "./styles/globals.css";
import "./app.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
