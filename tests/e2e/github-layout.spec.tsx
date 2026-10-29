import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { RepositoryBatchForm } from "../../src/components/repository-batch-form";
import { GitHubConnection } from "../../src/components/github-connection";

test("GitHub connection and four repository results fit mobile screens", async ({
  page,
}) => {
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLLinkElement).href),
    );
  const css = (
    await Promise.all(
      styles.map(async (url) => (await page.request.get(url)).text()),
    )
  ).join("\n");
  const urls = Array.from(
    { length: 4 },
    (_, i) => `https://github.com/fixture/repository-${i}`,
  );
  await page.goto("about:blank");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["dark", "light"]) {
      const html = renderToStaticMarkup(
        <main
          className="main-content"
          style={{ margin: "0 auto", width: "100%" }}
        >
          <GitHubConnection
            connection={{ configured: true, connected: false }}
            busy={false}
            onDisconnect={() => {}}
          />
          <RepositoryBatchForm
            value={urls.join("\n")}
            onChange={() => {}}
            onSubmit={() => {}}
            onOpen={() => {}}
            busy={false}
            configured={true}
            error=""
            results={urls.map((url) => ({
              url,
              status: "checked",
              commits: 20,
            }))}
          />
        </main>,
      );
      await page.setContent(
        `<!doctype html><html data-theme="${theme}"><head><style>${css}</style></head><body>${html}</body></html>`,
      );
      await expect(
        page.getByRole("button", { name: "Connect GitHub", exact: true }),
      ).toBeEnabled();
      await expect(page.getByRole("status")).toContainText(
        "4 of 4 checked successfully",
      );
      await expect(page.locator(".batch-result")).toHaveCount(4);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      for (const button of await page.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
    }
  }
});
