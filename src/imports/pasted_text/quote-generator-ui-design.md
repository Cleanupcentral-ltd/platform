EXPAND THE EXISTING CLEAN UP CENTRAL QUOTE GENERATOR UI

Review the attached Phase 0 Rules and Database Blueprint in full before designing. Use it to identify and create the principal visual variations required for every quote journey and conditional form state.

SOURCE PRIORITY

1. Clean Up Central Design System — controls all visual decisions.
2. Attached Phase 0 YAML — controls journeys, questions, conditional behaviour and result types.
3. This prompt — controls the required Figma coverage.
4. Existing Quote Generator UI — retain and extend wherever it does not conflict.

Do not redesign the existing quote generator or invent new pricing, questions, services, rules or functionality.

OBJECTIVE

Create a complete visual reference for building the quote generator in Wix Studio with a Multi-State Box and Velo.

Figma must show what each significant conditional state looks like. It does not need to create every possible answer combination.

Keep the four main progress stages:

1. Service Type
2. Property Details
3. Your Details
4. Summary

Subquestions may change within these stages without adding more numbered steps.

CREATE THESE DESKTOP VARIATIONS

A. SHARED ENTRY

1. Service Type / Default
Show:
- Residential Cleaning
- Airbnb Turnover
- Commercial Cleaning
- Property Support

2. Your Details / Standard Customer
Include:
- Full name
- Email address
- Phone number
- Company or agency name where applicable
- New or existing customer question
- Preferred contact method
- Required consent
- Back and Continue to Summary buttons

B. RESIDENTIAL CLEANING

3. Residential / Property Type
- House
- Flat / Apartment

4. Residential / Cleaning Service
- Standard Clean
- Deep Clean
- End of Tenancy

5. Residential Standard or Deep / Scope
- Whole Property
- Selected Rooms

6. Residential / Whole Property
Show:
- Property size
- Bathroom quantity
- Conditional exact-bedroom field when 4+ Bedrooms is selected
- A clear example of the quantity-control and selection components

7. Residential / Selected Rooms
Show quantity selectors for:
- Bathroom
- Bedroom
- Kitchen
- Living Room
- Hallway
- Stairs (one unit = one flight)

Make it clear that multiple room types and quantities can be selected. The cleaning level is inherited from Standard or Deep and cannot be mixed.

8. Residential / Eligible Extras
Show the reusable extras layout for:
- Oven
- Fridge
- Interior Windows
- Grout Cleaning

Use quantity controls where required.

9. Residential / End of Tenancy
Create a custom-quotation state collecting:
- Property details
- Condition details
- Relevant photographs
- Address and appointment
- Customer details

Do not show scope selection, optional extras, instant price, discount or deposit estimate.

C. AIRBNB TURNOVER

10. Airbnb / Property Details
Show:
- Property size
- Bathroom quantity
- Conditional exact-bedroom field for 4+ Bedrooms

11. Airbnb / Condition
Show:
- Good
- Moderate
- Dirty

Add concise supporting descriptions without inventing new business rules.

12. Airbnb / Dirty Selected
Show the important conditional state:
- Dirty visibly selected
- Photos marked as required
- Provisional-estimate notice
- Manual-review explanation
- Upload component with an uploaded-photo example

13. Airbnb / Extras
Show:
- Oven
- Fridge
- Interior Windows
- Grout Cleaning
- Laundry, with number-of-loads control
- Standard Consumables Package

D. COMMERCIAL CLEANING

14. Commercial / Requirements
Create the principal custom-quote form state covering:
- Premises description
- Current condition
- Cleaning requirements
- One-off or Recurring
- Preferred days and times
- Access and operational requirements

15. Commercial / Recurring Selected
Show the conditional frequency options:
- Daily
- Five times weekly
- Three times weekly
- Twice weekly
- Weekly
- Fortnightly
- Monthly
- Ad hoc
- Other / Not sure

16. Commercial / Supporting Details
Show:
- Supporting photos or documents
- Property address
- Preferred start date
- Company and contact details

Do not show an instant price, discount or deposit estimate.

E. PROPERTY SUPPORT

17. Property Support / Service Selection
Use multi-select cards for:
- Key Holding
- Property Inspection
- Contractor Access
- Inventory Check
- Emergency Attendance
- Not Sure

Make the multi-select behaviour visually clear.

18. Property Support / Property and Requirements
Show:
- Property type
- Address and postcode
- Number of properties
- Occupied, vacant or short-let status
- Access arrangements
- Description of support required

19. Property Support / Arrangement
Show:
- One-off
- Recurring
- Preferred start date
- Urgency: Standard, Urgent or Emergency

20. Property Support / Recurring Selected
Reveal:
- Weekly
- Fortnightly
- Monthly
- Ad hoc
- Other

21. Property Support / One-off Selected
Reveal:
- Required completion date

22. Property Support / Supporting Information
Show:
- Preferred contact method
- Customer and company details
- Photos or documents
- Access notes
- Additional comments

Do not show bedrooms, bathrooms, cleaning type, cleaning extras, instant price, discount or deposit estimate.

F. SHARED ADDRESS AND APPOINTMENT

23. Address and Appointment / Standard
Show:
- Address
- Postcode
- Preferred date
- Preferred arrival window
- Parking details
- Pets at the property
- Access notes

Use the approved arrival windows from Phase 0.

24. Address and Appointment / Manual Review Notice
Show a reusable notice treatment for conditions such as:
- Same-day request
- Bank-holiday request
- Outside or unknown service area

Do not imply automatic rejection.

G. SUMMARY AND RESULT STATES

25. Estimated Quote / Standard
Create a complete estimate breakdown capable of displaying:
- Base whole-property price or selected-room total
- Additional bathrooms where applicable
- Airbnb condition charge where applicable
- Extras
- Travel fee
- Eligible discount
- Estimated total

Primary button:
Submit Quote for Review

Include the warning that an estimate is not a confirmed booking and the date is secured only after approval and the required upfront payment.

Do not present the review submission button as a payment button.

26. Estimated Quote / Dirty Airbnb
Show:
- Provisional estimate label
- Dirty-condition charge
- Notice that the charge may change following review
- Confirmation that supplied photographs will be reviewed

27. Custom Quotation Required / End of Tenancy

28. Custom Quotation Required / Commercial Cleaning

29. Custom Quotation Required / Property Support

Each custom-quotation summary should recap the submitted request without showing an invented price, discount or deposit.

Primary button:
Submit Request for Review

30. Submitted / Under Review
Show:
- Successful submission confirmation
- Quote reference placeholder
- Explanation of what happens next
- No suggestion that the booking is confirmed

31. More Information Required
Show a request for missing information or photographs with a clear action button.

32. Revised Quote
Show a revised-quote presentation with a clear distinction between the earlier estimate and reviewed total.

33. Approved / Upfront Payment Required
Show an approved quote with:
- Required upfront-payment amount
- Remaining balance
- Secure payment action
- Notice that the booking is confirmed only after payment clears

34. Rejected or Unable to Proceed
Create a calm, professional outcome state without accusatory wording.

VALIDATION AND COMPONENT STATES

Also create a compact component/state sheet showing:

- Default, hover, selected, completed and disabled selection cards
- Required-field error
- Invalid email or phone
- Missing consent
- Missing required photograph
- Uploading, uploaded and upload-failed states
- Quantity control at zero and with a selected quantity
- Date unavailable or invalid
- Loading/calculating estimate
- Manual-review notice
- Provisional-price notice
- Back, Continue and Submit button states

RESPONSIVE COVERAGE

Create full 390px mobile frames for these principal reference screens:

- Service Type
- Residential Whole Property
- Residential Selected Rooms
- Residential End of Tenancy
- Airbnb Dirty condition
- Commercial Recurring
- Property Support service selection
- Property Support Recurring
- Address and Appointment
- Your Details
- Estimated Quote
- Custom Quotation Required
- Submitted / Under Review

Use responsive stacking, comfortable tap targets and the Design System’s mobile spacing. Do not remove required information on mobile.

FIGMA BUILD REQUIREMENTS

- Place all frames on the existing “06 - Quote Generator UI” page.
- Preserve existing approved screens and improve only where Phase 0 shows missing information.
- Use Auto Layout and reusable components throughout.
- Name frames, sections and layers clearly.
- Keep all text editable.
- Use the same header, stepper, cards, forms, notices, upload fields, buttons and summary components consistently.
- Include Back and Continue controls where appropriate.
- Show active and completed stepper states accurately.
- Keep the designs practical to reproduce in Wix Studio.
- Do not design every mathematical permutation.
- Do not create a working prototype or pricing engine.
- Do not invent final quote references, customer details, availability, statistics or prices.
- Use clearly marked placeholders where sample data is necessary.
- Do not alter unrelated website pages.

Before completing the task, compare every created route against the attached Phase 0 YAML and confirm that Residential Whole Property, Residential Selected Rooms, End of Tenancy, Airbnb, Commercial and Property Support all have sufficient visual coverage for the Wix Studio build.
