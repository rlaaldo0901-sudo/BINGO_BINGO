import "./styles.css";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css"; // 있으면 유지

createRoot(document.getElementById("root")!).render(<App />);
