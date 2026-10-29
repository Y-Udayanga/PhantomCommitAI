import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
await page.screenshot({ path: "docs/screenshots/landing.png", fullPage: true });
await page.goto("http://127.0.0.1:3000/auth", { waitUntil: "networkidle" });
await page.screenshot({ path: "docs/screenshots/auth.png", fullPage: true });
console.log(JSON.stringify({ screenshots: 2, pageErrors: errors }));
await browser.close();
