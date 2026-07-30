import { z } from "zod";

import {
  QUOTE_ATTACHMENT_POLICY,
} from "./quote-attachment.js";

import {
  AIRBNB_CONDITIONS,
  ARRANGEMENTS,
  ARRIVAL_WINDOWS,
  CLEANING_SCOPES,
  COMMERCIAL_FREQUENCIES,
  DECLARED_CUSTOMER_TYPES,
  PREFERRED_CONTACT_METHODS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  RESIDENTIAL_SERVICES,
  SUPPORT_FREQUENCIES,
  SUPPORT_SERVICES,
  URGENCY_LEVELS,
} from "../../domain/quote-values.js";

const requiredText = (
  maximumLength: number,
) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximumLength);

const optionalText = (
  maximumLength: number,
) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .default("");

const quantity = z
  .number()
  .int()
  .min(0)
  .max(50);

const singleQuantity = z
  .number()
  .int()
  .min(0)
  .max(1);

const dateOnly = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Use the YYYY-MM-DD date format.",
  );

const roomQuantitiesSchema = z.strictObject({
  Bathroom: quantity,
  Bedroom: quantity,
  Kitchen: quantity,
  "Living Room": quantity,
  Hallway: singleQuantity,
  Stairs: singleQuantity,
});

const extrasSchema = z.strictObject({
  Oven: quantity,
  Fridge: quantity,
  "Interior Windows": quantity,
  "Grout Cleaning": quantity,
  Laundry: quantity,

  "Standard Consumables Package": z
    .number()
    .int()
    .min(0)
    .max(1),
});

const customerSchema = z.strictObject({
  fullName: requiredText(120),

  companyName: optionalText(160),

  email: z
    .string()
    .trim()
    .max(254)
    .email("Enter a valid email address."),

  phone: z
    .string()
    .trim()
    .regex(
      /^[+()\d\s-]{7,20}$/,
      "Enter a valid phone number.",
    ),

  declaredCustomerType: z.enum(
    DECLARED_CUSTOMER_TYPES,
  ),

  preferredContactMethod: z.enum(
    PREFERRED_CONTACT_METHODS,
  ),

  privacyConsent: z.literal(true, {
    error: "Privacy consent is required.",
  }),

  marketingConsent: z.boolean().default(false),
});

const propertySchema = z.strictObject({
  propertyType: z
    .union([
      z.enum(PROPERTY_TYPES),
      z.literal(""),
    ])
    .default(""),

  address: requiredText(300),

  postcode: requiredText(12),

  bedrooms: z
    .number()
    .int()
    .min(0)
    .max(20),

  bathrooms: z
    .number()
    .int()
    .min(0)
    .max(20),

  propertyCount: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(1),

  propertyStatus: z
    .union([
      z.enum(PROPERTY_STATUSES),
      z.literal(""),
    ])
    .default(""),

  parkingDetails: optionalText(1_000),
  petsDetails: optionalText(1_000),
  accessArrangements: optionalText(2_000),
});

const appointmentSchema = z.strictObject({
  preferredDate: z
    .union([dateOnly, z.literal("")])
    .default(""),

  arrivalWindow: z
    .union([
      z.enum(ARRIVAL_WINDOWS),
      z.literal(""),
    ])
    .default(""),

  preferredStartDate: z
    .union([dateOnly, z.literal("")])
    .default(""),

  requiredCompletionDate: z
    .union([dateOnly, z.literal("")])
    .default(""),

  sameDay: z.boolean().default(false),
});

const residentialServiceSchema = z.strictObject({
  category: z.literal("Residential Cleaning"),

  serviceType: z.enum(RESIDENTIAL_SERVICES),

  cleaningScope: z
    .union([
      z.enum(CLEANING_SCOPES),
      z.literal(""),
    ])
    .default(""),

  rooms: roomQuantitiesSchema,

  extras: extrasSchema,

  currentCondition: optionalText(2_000),

  requirements: optionalText(2_000),
});

const airbnbServiceSchema = z.strictObject({
  category: z.literal("Airbnb Turnover"),

  serviceType: z.literal("Airbnb Turnover"),

  airbnbCondition: z.enum(AIRBNB_CONDITIONS),

  extras: extrasSchema,
});

const commercialServiceSchema = z.strictObject({
  category: z.literal("Commercial Cleaning"),

  serviceType: z.literal("Commercial Cleaning"),

  premisesDescription: requiredText(2_000),

  currentCondition: requiredText(2_000),

  requirements: requiredText(3_000),

  operationalRequirements: optionalText(3_000),

  arrangement: z.enum(ARRANGEMENTS),

  frequency: z
    .union([
      z.enum(COMMERCIAL_FREQUENCIES),
      z.literal(""),
    ])
    .default(""),

  otherFrequency: optionalText(500),

  preferredSchedule: optionalText(1_000),
});

const propertySupportServiceSchema = z.strictObject({
  category: z.literal("Property Support"),

  serviceType: z.literal("Property Support"),

  supportServices: z
    .array(z.enum(SUPPORT_SERVICES))
    .min(1)
    .max(SUPPORT_SERVICES.length),

  requirements: requiredText(3_000),

  operationalRequirements: optionalText(3_000),

  arrangement: z.enum(ARRANGEMENTS),

  frequency: z
    .union([
      z.enum(SUPPORT_FREQUENCIES),
      z.literal(""),
    ])
    .default(""),

  otherFrequency: optionalText(500),

  urgency: z.enum(URGENCY_LEVELS),
});

const serviceSchema = z.discriminatedUnion(
  "category",
  [
    residentialServiceSchema,
    airbnbServiceSchema,
    commercialServiceSchema,
    propertySupportServiceSchema,
  ],
);

const clientEstimateSchema = z.strictObject({
  pricingVersion: requiredText(100),

  estimatedTotal: z
    .number()
    .finite()
    .min(0),
});

function totalRoomQuantity(
  rooms: z.infer<typeof roomQuantitiesSchema>,
): number {
  return Object.values(rooms).reduce(
    (total, roomQuantity) =>
      total + roomQuantity,
    0,
  );
}

export const submitQuoteSchema = z
  .strictObject({
    submissionId: z
      .string()
      .uuid("Submission ID must be a valid UUID."),

    schemaVersion: z.literal("1.0"),

    customer: customerSchema,

    property: propertySchema,

    appointment: appointmentSchema,

    service: serviceSchema,

    safetyWarnings: optionalText(2_000),

    additionalNotes: optionalText(2_000),

    attachmentCount: z
      .number()
      .int()
      .min(0)
      .max(
        QUOTE_ATTACHMENT_POLICY.maxFiles,
      )
      .default(0),

    /*
     * This is accepted only for diagnostics.
     * The backend will never trust it as the final price.
     */
    clientEstimate:
      clientEstimateSchema.optional(),
  })
  .superRefine((submission, context) => {
    const addIssue = (
      path: (string | number)[],
      message: string,
    ): void => {
      context.addIssue({
        code: "custom",
        path,
        message,
      });
    };

    const { service, property, appointment } =
      submission;

    if (
      service.category ===
      "Residential Cleaning"
    ) {
      if (!property.propertyType) {
        addIssue(
          ["property", "propertyType"],
          "Residential Cleaning requires a property type.",
        );
      }

      if (
        !appointment.preferredDate ||
        !appointment.arrivalWindow
      ) {
        addIssue(
          ["appointment"],
          "Choose a preferred date and arrival window.",
        );
      }

      if (
        service.serviceType ===
        "End of Tenancy"
      ) {
        if (submission.attachmentCount < 1) {
          addIssue(
            ["attachmentCount"],
            "End of Tenancy requires at least one photo.",
          );
        }

        return;
      }

      if (!service.cleaningScope) {
        addIssue(
          ["service", "cleaningScope"],
          "Choose Whole Property or Selected Rooms.",
        );
      }

      if (
        service.cleaningScope ===
          "Whole Property" &&
        property.bathrooms < 1
      ) {
        addIssue(
          ["property", "bathrooms"],
          "Whole-property cleaning requires at least one bathroom.",
        );
      }

      if (
        service.cleaningScope ===
          "Selected Rooms" &&
        totalRoomQuantity(service.rooms) < 1
      ) {
        addIssue(
          ["service", "rooms"],
          "Select at least one room.",
        );
      }
    }

    if (
      service.category === "Airbnb Turnover"
    ) {
      if (!property.propertyType) {
        addIssue(
          ["property", "propertyType"],
          "Airbnb Turnover requires a property type.",
        );
      }

      if (property.bathrooms < 1) {
        addIssue(
          ["property", "bathrooms"],
          "Airbnb Turnover requires at least one bathroom.",
        );
      }

      if (
        !appointment.preferredDate ||
        !appointment.arrivalWindow
      ) {
        addIssue(
          ["appointment"],
          "Choose a preferred date and arrival window.",
        );
      }

      if (
        service.airbnbCondition === "Dirty" &&
        submission.attachmentCount < 1
      ) {
        addIssue(
          ["attachmentCount"],
          "Dirty Airbnb requests require at least one photo.",
        );
      }
    }

    if (
      service.category ===
      "Commercial Cleaning"
    ) {
      if (!appointment.preferredStartDate) {
        addIssue(
          [
            "appointment",
            "preferredStartDate",
          ],
          "Commercial Cleaning requires a preferred start date.",
        );
      }

      if (
        service.arrangement === "Recurring"
      ) {
        if (!service.frequency) {
          addIssue(
            ["service", "frequency"],
            "Choose a recurring frequency.",
          );
        }

        if (!service.preferredSchedule) {
          addIssue(
            [
              "service",
              "preferredSchedule",
            ],
            "Describe the preferred days and times.",
          );
        }

        if (
          service.frequency ===
            "Other / Not sure" &&
          !service.otherFrequency
        ) {
          addIssue(
            ["service", "otherFrequency"],
            "Describe the required frequency.",
          );
        }
      }
    }

    if (
      service.category === "Property Support"
    ) {
      if (!appointment.preferredStartDate) {
        addIssue(
          [
            "appointment",
            "preferredStartDate",
          ],
          "Property Support requires a preferred start date.",
        );
      }

      if (
        service.supportServices.includes(
          "Not Sure",
        ) &&
        service.supportServices.length > 1
      ) {
        addIssue(
          ["service", "supportServices"],
          "Not Sure cannot be selected with another Property Support service.",
        );
      }

      if (!property.propertyStatus) {
        addIssue(
          ["property", "propertyStatus"],
          "Choose the current property status.",
        );
      }

      if (
        service.arrangement === "Recurring"
      ) {
        if (!service.frequency) {
          addIssue(
            ["service", "frequency"],
            "Choose a recurring frequency.",
          );
        }

        if (
          service.frequency === "Other" &&
          !service.otherFrequency
        ) {
          addIssue(
            ["service", "otherFrequency"],
            "Describe the required frequency.",
          );
        }
      }
    }
  });

export type SubmitQuoteRequest = z.infer<
  typeof submitQuoteSchema
>;