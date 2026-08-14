import React from "react";
import ReactDOM from "react-dom/client";

import { LeadEngineFoundation } from "./LeadEngineFoundation";
import { ManualOutreachGate } from "./ManualOutreachGate";
import "./styles.css";

ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
).render(
  <React.StrictMode>
    <LeadEngineFoundation />
    <ManualOutreachGate />
  </React.StrictMode>,
);
