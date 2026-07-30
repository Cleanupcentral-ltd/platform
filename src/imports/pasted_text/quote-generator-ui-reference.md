You are a Senior Product Designer creating the visual UI reference for the Clean Up Central Quote Generator.

This is not a marketing page. It is a multi-step application interface embedded within the website. Prioritise clarity, usability, trust and conversion over visual novelty. Every interaction should reduce cognitive load and help users complete their quote with confidence.

Match the approved website aesthetic and existing mock-ups as closely as possible.

This is not a working Figma prototype. The real Quote Generator will be built in Wix Studio using Multi-State Boxes and Velo. Your role is to produce a polished visual reference suitable for implementation.

Existing Design System

Reuse the existing Design System already present in this project.

Reuse wherever possible:

Typography
Colour palette
Grid
Spacing
Navigation
Buttons
Forms
Cards
Icons
Notices
Progress indicators
Selection components
Existing interaction patterns

Create new components only if no suitable component already exists.

Maintain complete visual consistency with the Home page and the rest of the website.

UX Principles

The Quote Generator should feel:

Calm
Premium
Professional
Effortless
Trustworthy

Present only one primary question per state.

Never overwhelm the user with unnecessary information.

Only display information required for the current step.

Each screen should guide the customer naturally towards completion.

Frames to Create

Create a Figma page named:

06 — Quote Generator UI

Include the following production-quality frames:

Desktop (1440px)
Quote / Desktop / Entry Selection
Quote / Desktop / Standard Question
Quote / Desktop / Review Your Quote
Quote / Desktop / Tailored Quote Required
Quote / Desktop / Submitted Under Review
Tablet (1024px)
Quote / Tablet / Standard Question
Mobile (390px)
Quote / Mobile / Entry Selection
Quote / Mobile / Standard Question
Quote / Mobile / Review
Quote / Mobile / Submitted

Each frame should be designed as though it were a production-ready application screen using consistent spacing, Auto Layout and reusable components throughout.

The collection of screens should feel like one cohesive product rather than separate mock-ups.

Entry Selection

Match the approved visual mock-up.

Use the existing website header.

Below the header place a centred four-stage progress indicator:

Service Type
Property Details
Your Details
Summary

The active stage should use the existing gold accent.

Add a small developer annotation explaining:

Velo may display conditional "Step X of Y" substeps within each stage.

Below the stepper:

Headline:

Let's get you an instant quote

One concise supporting sentence.

Below this place four equal selection cards:

Residential Cleaning
Airbnb Turnover
Commercial Cleaning
Property Support

Each card includes:

simple outline icon
title
one-line description

Residential Cleaning is selected with the approved gold border.

Place a centred gold Continue → button beneath the cards.

Do not display:

quote summary
estimated price
estimated duration
discounts
deposits
Representative Application States
1. Standard Question

Display:

one primary question
concise help text
selectable cards or appropriate form controls
Back button
Continue button

Continue remains disabled until the required input is valid.

2. Review Your Quote

Structure the screen using the following hierarchy:

Estimated Quote

↓

Quote Breakdown

↓

Important Information

↓

Primary Action

Display placeholder values only:

£--.--

Include a clear notice that this is an estimated quotation and not a confirmed booking.

Primary CTA:

Submit Quote for Review

3. Dirty Airbnb

Show:

provisional badge
condition fee placeholder
explanation that the estimate may change following manual review
4. Tailored Quote Required

For:

End of Tenancy
Commercial Cleaning
Property Support

Display:

no instant quotation
no estimated deposit
no automatic discount

Explain that the quotation will be prepared following review by the team.

5. Upload State

Demonstrate the complete upload experience:

Empty upload area
Drag & Drop area
Browse Files button
Uploading
Upload Complete
Upload Failed

If no files exist, display an elegant empty state rather than blank space.

6. Validation

Include:

inline field validation
concise validation summary at the top of the screen

Errors should be informative without feeling alarming.

7. Submitted / Under Review

Display:

success icon
quote reference placeholder
submitted summary
explanation of next steps
email confirmation message
Start Another Quote button
8. Submission Error

Display:

saved progress message
Retry button
Contact Us button

Provide reassurance that information has not been lost.

Responsive Behaviour
Tablet
two selection cards per row where appropriate
maintain generous spacing
Mobile

Stack all cards vertically.

Replace the full progress indicator with:

Step X of Y

The Review screen may use:

collapsible summary
full-width summary card

Do not force a permanent side panel if it compromises usability.

Visual Rules

Maintain a centred, calm and spacious layout.

Follow these rules:

one primary question per state
no more than four comparable options without grouping
minimum 44px touch targets
obvious selected states
consistent spacing
premium editorial styling

Do not create:

marketing hero sections
payment screens
booking confirmation flows
branching prototypes
unnecessary animations
Wix Studio Implementation

Treat every representative frame as the visual reference for a future Multi-State Box.

Design components so they can be recreated using:

Sections
Stacks
Grids
Repeaters
Multi-State Boxes
Velo

Keep these modular:

progress stepper
state content
navigation
buttons
forms
notices
upload areas

Velo will control:

branching logic
pricing calculations
validation
uploads
retained answers
review status
quote submission
Constraints

Do not invent:

pricing rules
discounts
quote numbers
business logic
conditional flows
review outcomes
business processes

Where information is unknown, use clearly labelled placeholders.

Final Validation

Before finishing, verify that:

the Quote Generator matches the existing Design System
it feels like part of the existing website
every frame is production-ready rather than a wireframe
reusable components are used wherever possible
layouts are practical to recreate in Wix Studio
unknown information is represented with placeholders only
the final result is suitable as the definitive UI reference for development in Wix Studio with Velo