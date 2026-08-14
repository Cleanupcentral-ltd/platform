import React from "react";
import ReactDOM from "react-dom/client";

import { LeadEngineFoundation } from "./LeadEngineFoundation";
import { RedesignedWorkspaceGate } from "./RedesignedWorkspaceGate";
import "./styles.css";

ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
).render(
  <React.StrictMode>
    <LeadEngineFoundation />
    <RedesignedWorkspaceGate />
  </React.StrictMode>,
);
