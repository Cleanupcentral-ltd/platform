import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_CMS_CONTENT,
  type CmsContent,
  type FaqItem,
  type PageSection,
  type SiteSetting,
  type SiteStatistic,
} from "./cmsTypes";
import { loadCmsContent } from "./loadCmsContent";

interface CmsContextValue {
  content: CmsContent;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const CmsContext =
  createContext<CmsContextValue | undefined>(undefined);

export function CmsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [content, setContent] =
    useState<CmsContent>(EMPTY_CMS_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const nextContent = await loadCmsContent();
      setContent(nextContent);
      setError(null);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error(
              "Wix CMS content could not be loaded.",
            );

      setError(nextError);

      console.error(
        "Wix CMS content could not be loaded.",
        caughtError,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      content,
      loading,
      error,
      refresh,
    }),
    [content, loading, error, refresh],
  );

  return (
    <CmsContext.Provider value={value}>
      {children}
    </CmsContext.Provider>
  );
}

export function useCms(): CmsContextValue {
  const context = useContext(CmsContext);

  if (!context) {
    throw new Error(
      "useCms must be used inside CmsProvider.",
    );
  }

  return context;
}

export function usePageSection(
  contentKey: string,
): PageSection | undefined {
  const { content } = useCms();

  return content.pageSections.find(
    (item) => item.title === contentKey,
  );
}

export function usePageSections(
  page: string,
  section?: string,
): PageSection[] {
  const { content } = useCms();

  return content.pageSections.filter(
    (item) =>
      item.page === page &&
      (!section || item.section === section),
  );
}

export function useFaqs(): FaqItem[] {
  return useCms().content.faqs;
}

export function useSiteSetting(
  settingKey: string,
): SiteSetting | undefined {
  const { content } = useCms();

  return content.siteSettings.find(
    (item) => item.title === settingKey,
  );
}

export function useSiteStatistics(
  page = "about",
): SiteStatistic[] {
  const { content } = useCms();

  return content.siteStatistics.filter(
    (item) => item.page === page,
  );
}