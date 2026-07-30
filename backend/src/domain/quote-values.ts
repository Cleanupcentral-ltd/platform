export const QUOTE_CATEGORIES = [
  "Residential Cleaning",
  "Airbnb Turnover",
  "Commercial Cleaning",
  "Property Support",
] as const;

export type QuoteCategory =
  (typeof QUOTE_CATEGORIES)[number];

export const PROPERTY_TYPES = [
  "House",
  "Flat / Apartment",
] as const;

export type PropertyType =
  (typeof PROPERTY_TYPES)[number];

export const RESIDENTIAL_SERVICES = [
  "Standard Clean",
  "Deep Clean",
  "End of Tenancy",
] as const;

export type ResidentialService =
  (typeof RESIDENTIAL_SERVICES)[number];

export const CLEANING_SCOPES = [
  "Whole Property",
  "Selected Rooms",
] as const;

export type CleaningScope =
  (typeof CLEANING_SCOPES)[number];

export const ROOM_NAMES = [
  "Bathroom",
  "Bedroom",
  "Kitchen",
  "Living Room",
  "Hallway",
  "Stairs",
] as const;

export type RoomName = (typeof ROOM_NAMES)[number];

export const EXTRA_NAMES = [
  "Oven",
  "Fridge",
  "Interior Windows",
  "Grout Cleaning",
  "Laundry",
  "Standard Consumables Package",
] as const;

export type ExtraName = (typeof EXTRA_NAMES)[number];

export const AIRBNB_CONDITIONS = [
  "Good",
  "Moderate",
  "Dirty",
] as const;

export type AirbnbCondition =
  (typeof AIRBNB_CONDITIONS)[number];

export const ARRIVAL_WINDOWS = [
  "08:00–11:00",
  "11:00–14:00",
  "14:00–17:00",
  "17:00–20:00",
] as const;

export type ArrivalWindow =
  (typeof ARRIVAL_WINDOWS)[number];

export const DECLARED_CUSTOMER_TYPES = [
  "New customer",
  "Existing customer",
] as const;

export type DeclaredCustomerType =
  (typeof DECLARED_CUSTOMER_TYPES)[number];

export const PREFERRED_CONTACT_METHODS = [
  "Email",
  "Phone",
  "WhatsApp",
] as const;

export type PreferredContactMethod =
  (typeof PREFERRED_CONTACT_METHODS)[number];

export const ARRANGEMENTS = [
  "One-off",
  "Recurring",
] as const;

export type Arrangement =
  (typeof ARRANGEMENTS)[number];

export const COMMERCIAL_FREQUENCIES = [
  "Daily",
  "Five times weekly",
  "Three times weekly",
  "Twice weekly",
  "Weekly",
  "Fortnightly",
  "Monthly",
  "Ad hoc",
  "Other / Not sure",
] as const;

export type CommercialFrequency =
  (typeof COMMERCIAL_FREQUENCIES)[number];

export const SUPPORT_FREQUENCIES = [
  "Weekly",
  "Fortnightly",
  "Monthly",
  "Ad hoc",
  "Other",
] as const;

export type SupportFrequency =
  (typeof SUPPORT_FREQUENCIES)[number];

export const SUPPORT_SERVICES = [
  "Key Holding",
  "Property Inspection",
  "Contractor Access",
  "Inventory Check",
  "Emergency Attendance",
  "Not Sure",
] as const;

export type SupportService =
  (typeof SUPPORT_SERVICES)[number];

export const PROPERTY_STATUSES = [
  "Occupied",
  "Vacant",
  "Short-let / holiday let",
  "Other / not sure",
] as const;

export type PropertyStatus =
  (typeof PROPERTY_STATUSES)[number];

export const URGENCY_LEVELS = [
  "Standard",
  "Urgent",
  "Emergency Attendance",
] as const;

export type UrgencyLevel =
  (typeof URGENCY_LEVELS)[number];

export const CUSTOMER_VERIFICATION_STATUSES = [
  "Unverified",
  "Verified New",
  "Verified Existing",
  "Review Required",
] as const;

export type CustomerVerificationStatus =
  (typeof CUSTOMER_VERIFICATION_STATUSES)[number];

export const QUOTE_STATUSES = [
  "Submitted",
  "In Review",
  "More Information Required",
  "Revised",
  "Approved",
  "Rejected",
  "Converted to Booking",
] as const;

export type QuoteStatus =
  (typeof QUOTE_STATUSES)[number];