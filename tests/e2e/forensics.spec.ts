import { test, expect } from "@playwright/test";
test("forensic endpoints protect saved evidence and scans", async ({
  request,
}) => {
  const id = "10000000-0000-4000-8000-000000000001";
  const response = await request.get(`/api/repositories/${id}/forensics`);
  expect([401, 503]).toContain(response.status());
  const blocked = await request.post(`/api/repositories/${id}/forensics`, {
    headers: { origin: "https://attacker.invalid" },
    data: { kind: "security", branch: "main" },
  });
  expect(blocked.status()).toBe(403);
});
test("new tools retain auth protection and fit mobile setup layouts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["recovery", "impact", "security", "timeline"]) {
    await page.goto(`/${route}`);
    await expect(page.locator(".forensic-workbench").or(page.getByRole("heading", {name:"Welcome back, detective."}))).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/(auth|${route})$`));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
