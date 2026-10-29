import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AIStudio from "../src/components/ai-studio";
it("renders the real task catalog with no invented results and disables requests without evidence", () => {
  const html = renderToStaticMarkup(
    createElement(AIStudio, {
      inspectedCount: 0,
      ready: false,
      busy: false,
      consent: false,
      onConsent: () => {},
      onRun: async () => {},
      result: null,
      onExport: () => {},
      onContinue: () => {},
    }),
  );
  expect(html).toContain("focused tools");
  expect(html).toContain("No repository connected");
  expect(html).toContain("Ghost explainer");
  expect(html).toContain("Root cause investigator");
  expect(html).toContain("disabled");
  expect(html).not.toContain("LATEST SAVED ANALYSIS");
  expect(html).not.toContain("spectral-api");
});
