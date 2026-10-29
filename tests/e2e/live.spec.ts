import { test, expect } from "@playwright/test";
test("live acceptance: login → import → inspect → Gemma → saved chat → export", async ({
  page,
}) => {
  test.setTimeout(180000);
  test.skip(
    !process.env.E2E_EMAIL ||
      !process.env.E2E_PASSWORD ||
      !process.env.E2E_REPOSITORY,
    "Requires a configured database, Gemini key, and dedicated test account.",
  );
  await page.goto("/auth");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page
    .getByRole("button", { name: "Investigate repository", exact: true })
    .click();
  await page.getByLabel("Repository URLs").fill(process.env.E2E_REPOSITORY!);
  await page
    .getByRole("button", { name: "Check repositories", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open explorer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Commit history" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load history", exact: true }).click();
  await page.locator(".commit-row").first().click();
  await expect(page.getByText("EVIDENCE INSPECTOR")).toBeVisible();
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByText("GEMMA · GENERATED ANALYSIS")).toBeVisible({
    timeout: 60000,
  });
  await page
    .getByRole("textbox", { name: "Investigation question" })
    .fill("What evidence is still missing, and what should I test next?");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByText("GEMMA · GENERATED ANALYSIS")).toHaveCount(2, {
    timeout: 60000,
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export investigation" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.md$/);
  await page.reload();
  await page.getByRole("button", { name: /AI detective/ }).click();
  await page.locator(".saved-thread").first().click();
  await expect(page.getByText("GEMMA · GENERATED ANALYSIS")).toHaveCount(2);
});
