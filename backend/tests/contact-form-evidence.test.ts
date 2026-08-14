import assert from "node:assert/strict";
import test from "node:test";

import {
  detectContactForm,
} from "../src/domain/contact-form-evidence.js";

test(
  "accepts a real contact form with message fields",
  () => {
    const result = detectContactForm(
      [
        "<form>",
        '<input name="name">',
        '<input type="email" name="email">',
        '<textarea name="message"></textarea>',
        "<button>Send message</button>",
        "</form>",
      ].join(""),
      new URL("https://example.com/contact-us"),
    );

    assert.ok(result !== null);
    assert.match(
      result.support,
      /^Verified contact form v2:/,
    );
  },
);

test(
  "rejects newsletter, search and unrelated forms on pages that mention contact elsewhere",
  () => {
    const page = [
      "<p>Contact us for more information.</p>",
      '<form><input type="search" name="q"><button>Search</button></form>',
      '<form><input type="email" name="email"><button>Subscribe to newsletter</button></form>',
    ].join("");

    assert.equal(
      detectContactForm(
        page,
        new URL(
          "https://example.com/privacy-policy",
        ),
      ),
      null,
    );
  },
);

test(
  "does not treat a generic form on privacy or terms pages as a contact route",
  () => {
    const generic =
      '<form><input name="name"><button>Continue</button></form>';

    assert.equal(
      detectContactForm(
        generic,
        new URL("https://example.com/privacy"),
      ),
      null,
    );
    assert.equal(
      detectContactForm(
        generic,
        new URL("https://example.com/terms"),
      ),
      null,
    );
  },
);

test(
  "allows a compact enquiry form on an explicit contact path",
  () => {
    const result = detectContactForm(
      '<form><input name="message"><button>Submit</button></form>',
      new URL("https://example.com/contact"),
    );

    assert.ok(result !== null);
  },
);
