import { RouterProvider } from "react-router";
import { router } from "./routes";
import AnalyticsConsent from "./AnalyticsConsent";

export default function App() {
  return <><RouterProvider router={router} /><AnalyticsConsent /></>;
}
