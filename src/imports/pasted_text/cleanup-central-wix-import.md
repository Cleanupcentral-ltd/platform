FINALISE THE CLEAN UP CENTRAL WEBSITE FOR WIX STUDIO IMPORT

Complete the following final refinements across the existing Clean Up Central website and Quote Generator designs.

Do not redesign the website, change approved layouts, rewrite unrelated copy or alter the approved customer journeys. Apply these updates consistently to all existing desktop and 390px mobile frames.

1. STANDARDISE CTA WORDING

Audit every button and text link across the website and Quote Generator. Replace inconsistent wording with the following approved CTA system:

Get a Quote
- Use as the universal website CTA that opens the main Quote Generator.
- Use consistently in the website header and general website sections.

Get an Instant Estimate
- Use when directing customers towards services that can produce an estimated price through the Quote Generator.
- This applies to eligible Standard Clean, Deep Clean and Airbnb Turnover journeys.

Request a Custom Quote
- Use for services that require individual assessment before a price can be provided.
- This applies to End of Tenancy, Commercial Cleaning and Property Support.

Submit Quote for Review
- Use as the final submission button when the customer has received an estimated price.
- The estimated price and submitted details still require review by Clean Up Central.

Submit Request for Review
- Use as the final submission button when no automatic estimated price is provided and the team must prepare a tailored quote.

Remove or replace inconsistent alternatives such as:
- Get an Instant Quote
- Instant Quote
- Instant Estimate when used alone as a button
- Tailored Quote when used alone as a button
- Enquire Now where the action is specifically a custom quote request

Retain “Contact Us” only for general contact or support actions.

Ensure every CTA leads to the correct page, Quote Generator route or prototype state.

2. KEEP WIX ANNOTATIONS OUTSIDE CUSTOMER FRAMES

Retain all useful Wix implementation annotations, but move every annotation outside the visible customer-facing frame.

Organise them in a clearly labelled section or layer named:

Wix Implementation Notes — Do Not Reproduce Visually

Annotations must not overlap or become part of the website layout. Keep them close enough to the relevant frame or component that their purpose remains clear.

For every unique Quote Generator screen or functional variation, document the following where applicable:

STATE NAME
- Provide a short, consistent Multi-State Box state name.
- Use lower camel case.
- Example: selectedRooms, airbnbDetails, customQuoteSummary.

ELEMENT IDs
- Assign a proposed Wix ID to every interactive element.
- Include buttons, inputs, quantity steppers, selection cards, upload controls, error messages, summaries and conditional containers.
- Wix IDs must begin with # and use lower camel case.
- Examples: #continueButton, #bedroomQuantity, #propertyPhotosUpload.

CONDITIONAL BEHAVIOUR
- State what appears, disappears, expands, collapses or changes after each relevant selection.
- Explain where each Continue, Back and Edit action leads.
- Identify inherited selections and values.
- Do not create separate Wix states for simple conditional fields that can be shown or hidden within an existing state.

REQUIRED-FIELD RULES
- Clearly identify every required field.
- Include the validation condition and user-facing error message.
- Note any conditionally required fields.
- Do not visually display error states permanently in the main customer reference frame; show them as separate component or interaction examples.

PRICING RULES
- Identify which selections affect the estimated price.
- Record applicable unit prices, quantities, surcharges, extras, discounts and travel calculations.
- Use the Phase 0 specification as the sole source of truth.
- Do not invent, infer or modify pricing.

MANUAL-REVIEW TRIGGERS
- Identify every answer or journey that prevents automatic pricing or requires additional review.
- Clearly distinguish:
  - An estimated quote submitted for review
  - A custom quote request requiring manual pricing
  - A condition that allows an estimate but flags the request for additional review
- Do not present manual review as an immediate approval or rejection.

3. LOCK THE FINAL TYPOGRAPHY SYSTEM

Finalise one global typography system for the Wix Studio import. Typography must not change unpredictably between pages containing the same type of content.

Create or update a clearly labelled Typography section on the existing Design System page.

Define and name the approved desktop and mobile styles for:

- Display / Hero Heading
- Page Heading
- Section Heading
- Card Heading
- Functional Heading
- Body Large
- Body Standard
- Body Small
- Eyebrow / Overline
- Form Label
- Input Text
- Helper and Error Text
- Button Text
- Navigation Text
- Footer Text

For every style, specify:

- Font family
- Font weight
- Desktop font size
- Mobile font size
- Line height
- Letter spacing
- Capitalisation rules where relevant

Use the expressive serif font selectively for brand-led hero, page and major section headings.

Use the approved sans-serif font for:
- Body copy
- Navigation
- Buttons
- Forms
- Quote Generator questions
- FAQ questions
- Labels
- Functional headings
- Helper and error text

Ensure functional pages such as FAQs, Contact Us and the Quote Generator remain clear and easy to use rather than excessively editorial.

Convert typography into consistent Figma text styles and apply those styles throughout every desktop and mobile frame. Remove arbitrary local font-size overrides unless a documented exception is genuinely required.

Do not change wording, layout or line breaks unnecessarily while applying the typography system. If a heading wraps poorly after standardisation, adjust its text container width or responsive layout before creating a new font size.

4. FINAL QUALITY CHECK

After applying the updates:

- Confirm that every CTA follows the approved wording and destination rules.
- Confirm that no Wix annotation remains inside any customer-facing frame.
- Confirm that all functional Quote Generator states contain sufficient Wix implementation notes.
- Confirm that identical text roles use the same typography style across all pages.
- Confirm that desktop and 390px mobile designs use the corresponding locked typography styles.
- Preserve Auto Layout, reusable components, variants and editable text.
- Do not alter the approved imagery, page structure, colours, spacing system or Quote Generator journeys.
- Do not add new pages or redesign any existing page.

The result should be a final, consistent Figma file ready to guide the Wix Studio import and Velo implementation.