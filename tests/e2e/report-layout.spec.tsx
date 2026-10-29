// Synthetic evidence is confined to this component layout test, never app data.
import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportCard, ReportIntro } from "../../src/components/report-card";
import type { Finding } from "../../src/lib/types";

const longPath = "src/" + "historical_validation_module_".repeat(12) + ".ts";
const finding: Finding = {
  title: "Removed validation in " + longPath,
  finding_type: "test fixture",
  summary:
    "Synthetic layout fixture for a long saved report. " +
    "unbroken_content_".repeat(40),
  severity: "high",
  evidence_status: "hypothesis",
  explanation:
    "if (" + "long_condition_".repeat(50) + ") {\n  return false;\n}",
  recommended_action:
    "Review the changed validation and reproduce the reported behavior before concluding that a regression exists.",
  evidence: [
    { sha: "a".repeat(40), file_path: longPath, html_url: "", verified: false },
  ],
};

test("populated reports wrap long evidence and keep mobile actions accessible", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLLinkElement).href),
    );
  expect(styles.length).toBeGreaterThan(0);
  const css = (
    await Promise.all(
      styles.map(async (url) => {
        const r = await page.request.get(url);
        expect(r.ok()).toBe(true);
        return r.text();
      }),
    )
  ).join("\n");
  await page.goto("about:blank");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["dark", "light"]) {
      const html = renderToStaticMarkup(
        <main
          className="main-content"
          style={{ margin: "0 auto", width: "100%" }}
        >
          <ReportIntro
            disabled={false}
            onGenerate={() => {}}
            consent={
              <label className="consent">
                <input type="checkbox" /> I allow selected public code excerpts
                to be processed by the selected hosted AI provider.
              </label>
            }
          />
          <ReportCard
            title={"Investigation for " + "repository_name_".repeat(18)}
            createdAt="2026-10-29T00:00:00Z"
            answer={"Historical context and unresolved questions.\n".repeat(12)}
            findings={[finding]}
            onExport={() => {}}
            onPrint={() => {}}
          />
        </main>,
      );
      await page.setContent(
        `<!doctype html><html data-theme="${theme}"><head><style>${css}</style></head><body>${html}</body></html>`,
        { waitUntil: "networkidle" },
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${theme} at ${width}px`,
      ).toBeLessThanOrEqual(width);
      for (const button of await page.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      if (width === 390)
        await page.screenshot({
          path: testInfo.outputPath(`populated-report-${theme}.png`),
          fullPage: true,
        });
    }
  }
});
