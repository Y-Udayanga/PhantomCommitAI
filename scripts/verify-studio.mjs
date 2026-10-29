// Checks a separately started setup instance. No repository records or AI responses are simulated.
import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(
  (process.env.STUDIO_BASE_URL || "http://127.0.0.1:3001") + "/intelligence",
  { waitUntil: "networkidle", timeout: 90000 },
);
await expect(page.getByRole("heading", { name: "AI Studio." })).toBeVisible();
await expect(page.locator(".studio-tool")).toHaveCount(18);
await expect(
  page.getByRole("button", { name: "Run investigation" }),
).toBeDisabled();
await page.getByRole("button", { name: "Understand", exact: true }).click();
await expect(page.locator(".studio-tool")).toHaveCount(4);
await page.getByRole("button", { name: "All tools", exact: true }).click();
await page
  .locator(".studio-tool")
  .filter({ hasText: "Root cause investigator" })
  .click();
await expect(page.locator(".studio-runner h3")).toHaveText(
  "Root cause investigator",
);
await page
  .getByRole("button", { name: "Investigate repository", exact: true })
  .click();
await expect(page.getByRole("dialog")).toBeVisible();
await page.keyboard.press("Escape");
await expect(page.getByRole("dialog")).toHaveCount(0);
mkdirSync("docs/screenshots", { recursive: true });
await page.screenshot({
  path: "docs/screenshots/ai-studio-setup.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
expect(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
).toBe(true);
await page.screenshot({
  path: "docs/screenshots/ai-studio-mobile-setup.png",
  fullPage: true,
});
expect(errors).toEqual([]);
console.log(
  JSON.stringify({
    tools: 18,
    categoryFilter: true,
    taskSelection: true,
    emptyEvidenceBlocksInference: true,
    keyboardDismissal: true,
    mobileOverflow: false,
    pageErrors: errors,
  }),
);
await browser.close();
