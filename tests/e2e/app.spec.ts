import { test, expect } from "@playwright/test";
test("landing links lead to real-data tools and contains no sample repository records", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every codebase/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open AI Studio" }),
  ).toHaveAttribute("href", "/intelligence");
  await expect(page.getByRole("link", { name: /demo/i })).toHaveCount(0);
  await expect(page.getByText("phantom-labs/spectral-api")).toHaveCount(0);
});
test("legacy demo URL redirects to the real workspace or sign in", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/(auth|repositories)$/);
  await expect(page.getByText(/Synthetic demo|Demo investigator/)).toHaveCount(
    0,
  );
});
test("authentication and recovery are real forms", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your workspace." }),
  ).toBeVisible();
  await page.goto("/auth?action=update");
  await expect(
    page.getByRole("heading", { name: "Choose a new password." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveCount(0);
});
test("mobile landing and sign in have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/auth"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("unauthenticated endpoints reject access and status never exposes keys", async ({
  request,
}) => {
  const r = await request.get("/api/repositories");
  expect([401, 503]).toContain(r.status());
  const status = await request.get("/api/status");
  const json = await status.json();
  expect(json.data.aiRoutes).toHaveProperty("features");
  expect(json.data.aiRoutes).toHaveProperty("detective");
  expect(JSON.stringify(json)).not.toMatch(/apiKey|AIza|GEMINI_API_KEY/);
});
