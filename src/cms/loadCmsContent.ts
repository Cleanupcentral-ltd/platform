import { wixClient } from "./wixClient";
import type {
  CmsBaseItem,
  CmsContent,
  FaqItem,
  PageSection,
  SiteSetting,
  SiteStatistic,
} from "./cmsTypes";

const COLLECTIONS = {
  pageSections: "PageSections",
  faqs: "FAQs",
  siteSettings: "SiteSettings",
  siteStatistics: "SiteStatistics",
} as const;

function orderNumber(value: number | undefined): number {
  return typeof value === "number"
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function byDisplayOrder<T extends CmsBaseItem>(
  left: T,
  right: T,
): number {
  return (
    orderNumber(left.displayOrder) -
    orderNumber(right.displayOrder)
  );
}

async function queryEnabledItems<T extends CmsBaseItem>(
  collectionId: string,
): Promise<T[]> {
  const result = await wixClient.items
    .query(collectionId)
    .eq("enabled", true)
    .limit(100)
    .find();

  return [...result.items] as T[];
}

export async function loadCmsContent(): Promise<CmsContent> {
  const [
    pageSections,
    faqs,
    siteSettings,
    siteStatistics,
  ] = await Promise.all([
    queryEnabledItems<PageSection>(COLLECTIONS.pageSections),
    queryEnabledItems<FaqItem>(COLLECTIONS.faqs),
    queryEnabledItems<SiteSetting>(COLLECTIONS.siteSettings),
    queryEnabledItems<SiteStatistic>(
      COLLECTIONS.siteStatistics,
    ),
  ]);

  pageSections.sort(byDisplayOrder);
  siteSettings.sort(byDisplayOrder);
  siteStatistics.sort(byDisplayOrder);

  faqs.sort((left, right) => {
    const categoryDifference =
      orderNumber(left.categoryOrder) -
      orderNumber(right.categoryOrder);

    return categoryDifference || byDisplayOrder(left, right);
  });

  return {
    pageSections,
    faqs,
    siteSettings,
    siteStatistics,
  };
}