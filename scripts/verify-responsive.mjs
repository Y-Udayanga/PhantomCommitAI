// Run against an unconfigured local setup instance; never bypass deployed auth.
// No sample records or API responses are injected.
import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.RESPONSIVE_BASE_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (
    message.type() === "error" &&
    /hydration|hydrated|didn't match/i.test(message.text())
  )
    errors.push(message.text());
});
const routes = [
  "/",
  "/auth",
  "/dashboard",
  "/repositories",
  "/graveyard",
  "/replay",
  "/haunted-bugs",
  "/intelligence",
  "/detective",
  "/resurrection",
  "/reports",
  "/settings",
];
mkdirSync("test-results/responsive", { recursive: true });
let checks = 0;
try {
  const status = await (await page.request.get(base + "/api/status")).json();
  expect(
    status.data.database,
    "Use a local setup build with the public Supabase variables empty; authenticated deployments require a test account.",
  ).toBe(false);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light"]) {
      await page.goto(base);
      const toggle = page.getByRole("button", {
        name: `Switch to ${theme} mode`,
      });
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await toggle.click();
      for (const route of routes) {
        await page.goto(base + route);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator(".theme-toggle").first()).toBeVisible();
        if (!["/", "/auth"].includes(route)) {
          await expect(page.locator(".workspace")).toBeVisible({
            timeout: 60000,
          });
        }
        const layout = await page.evaluate(() => ({
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          themeButton: document
            .querySelector(".theme-toggle")
            .getBoundingClientRect()
            .toJSON(),
        }));
        expect(
          layout.document,
          `${route} ${theme} at ${width}px`,
        ).toBeLessThanOrEqual(width);
        expect(
          layout.themeButton.width,
          `${route} ${theme} at ${width}px`,
        ).toBeGreaterThanOrEqual(44);
        expect(
          layout.themeButton.height,
          `${route} ${theme} at ${width}px`,
        ).toBeGreaterThanOrEqual(44);
        expect(layout.themeButton.right).toBeLessThanOrEqual(width);
        checks++;
        if (
          (width === 390 &&
            ["/auth", "/dashboard", "/intelligence"].includes(route)) ||
          (width === 1440 && route === "/")
        ) {
          await page.screenshot({
            path: `test-results/responsive/${route.slice(1) || "landing"}-${theme}-${width}.png`,
            fullPage: true,
          });
        }
      }
    }
    console.log(`Responsive layouts passed at ${width}px in both themes.`);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(base + "/repositories");
  await page
    .getByRole("button", { name: "Investigate repository", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      routeThemeViewportChecks: checks,
      widths: [320, 390, 768, 1440],
      importDialog: true,
      mobileNavigation: true,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}
