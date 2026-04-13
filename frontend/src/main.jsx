/**
 * main.jsx — Application Entry Point
 *
 * This is the FIRST JavaScript file that runs.
 * It mounts our React app into the HTML page.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Mount the React app into the <div id="root"> element in index.html
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
