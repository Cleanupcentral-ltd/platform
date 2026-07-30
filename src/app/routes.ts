import { createBrowserRouter, Outlet, useLocation } from "react-router";
import { createElement, useEffect } from "react";
import Home from "./Home";
import DesignSystem from "./DesignSystem";
import PlaceholderPage from "./PlaceholderPage";
import AboutPage from "./About";
import CleaningServicesPage from "./CleaningServices";
import PropertySupportPage from "./PropertySupport";
import ContactPage from "./Contact";
import QuotePage from "./Quote";
import FAQsPage from "./FAQs";

function SiteRouteLayout() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Every internal route should open at the beginning of the destination
    // page, including links that only change the quote-service query string.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return createElement(Outlet);
}

export const router = createBrowserRouter([
  {
    Component: SiteRouteLayout,
    children: [
      { path: "/home", Component: Home },
      { path: "/design-system", Component: DesignSystem },
      { path: "/about", Component: AboutPage },
      { path: "/cleaning-services", Component: CleaningServicesPage },
      { path: "/property-support", Component: PropertySupportPage },
      { path: "/quote", Component: QuotePage },
      { path: "/get-a-quote", Component: QuotePage },
      { path: "/contact", Component: ContactPage },
      { path: "/faqs", Component: FAQsPage },
      { path: "*", Component: Home },
    ],
  },
]);
