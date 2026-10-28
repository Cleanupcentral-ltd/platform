import { createHashRouter, Outlet, useLocation } from "react-router";
import { createElement, useEffect } from "react";
import Home from "./Home";
import DesignSystem from "./DesignSystem";
import AboutPage from "./About";
import CleaningServicesPage from "./CleaningServices";
import CommercialCleaningPage from "./CommercialCleaning";
import PropertySupportPage from "./PropertySupport";
import ContactPage from "./Contact";
import QuotePage from "./Quote";
import FAQsPage from "./FAQs";
import PrivacyPage from "./Privacy";
import TermsPage from "./Terms";

function SiteRouteLayout() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return createElement(Outlet);
}

export const router = createHashRouter([
  {
    Component: SiteRouteLayout,
    children: [
      { path: "/", Component: Home },
      { path: "/home", Component: Home },
      { path: "/design-system", Component: DesignSystem },
      { path: "/about", Component: AboutPage },
      { path: "/cleaning-services", Component: CleaningServicesPage },
      { path: "/commercial-cleaning", Component: CommercialCleaningPage },
      { path: "/property-support", Component: PropertySupportPage },
      { path: "/quote", Component: QuotePage },
      { path: "/get-a-quote", Component: QuotePage },
      { path: "/contact", Component: ContactPage },
      { path: "/faqs", Component: FAQsPage },
      { path: "/privacy", Component: PrivacyPage },
      { path: "/terms", Component: TermsPage },
      { path: "*", Component: Home },
    ],
  },
]);
