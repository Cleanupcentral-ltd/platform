import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { CmsProvider } from "./cms/CmsProvider";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <CmsProvider>
    <App />
  </CmsProvider>,
);