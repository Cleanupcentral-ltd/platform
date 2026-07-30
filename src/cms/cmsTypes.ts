export interface CmsBaseItem {
  _id?: string;
  title?: string;
  enabled?: boolean;
  displayOrder?: number;
}

export interface PageSection extends CmsBaseItem {
  page?: string;
  section?: string;
  contentType?: string;
  eyebrow?: string;
  heading?: string;
  accentText?: string;
  body?: string;
  supportingText?: string;
  image?: unknown;
  imageAltText?: string;
  primaryCtaText?: string;
  primaryCtaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
}

export interface FaqItem extends CmsBaseItem {
  category?: string;
  question?: string;
  answer?: string;
  categoryOrder?: number;
}

export interface SiteSetting extends CmsBaseItem {
  category?: string;
  label?: string;
  value?: string;
  link?: string;
}

export interface SiteStatistic extends CmsBaseItem {
  page?: string;
  value?: string;
  label?: string;
}

export interface CmsContent {
  pageSections: PageSection[];
  faqs: FaqItem[];
  siteSettings: SiteSetting[];
  siteStatistics: SiteStatistic[];
}

export const EMPTY_CMS_CONTENT: CmsContent = {
  pageSections: [],
  faqs: [],
  siteSettings: [],
  siteStatistics: [],
};