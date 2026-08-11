import { expect, test } from "@playwright/test";

// Onboarding / shell journey: a fresh operator lands on the portal and sees the accessible shell —
// skip link, the "Repository knowledge" navigation landmark, and the audit-mode posture — before any
// data is present. A repository with no measured metrics or integrations shows local onboarding
// rather than an empty overview that implies success.
test.describe("onboarding and the accessible shell", () => {
  test("the portal presents an accessible shell with the primary navigation landmark", async ({ page }) => {
    await page.goto("/app/");
    await expect(page.getByRole("navigation", { name: "Repository knowledge" })).toBeVisible();
    // The skip link is the first focusable element and targets the main region.
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toHaveAttribute("href", "#main-content");
  });

  test("the operator lands on Attention — decisions, not a dashboard", async ({ page }) => {
    await page.goto("/app/");
    await expect(page.getByRole("heading", { name: "Attention" })).toBeVisible();
    // The page states its own goal condition: an empty queue is success, not absence.
    await expect(page.getByText(/goal state of this page is empty/i)).toBeVisible();
    // The local flow never asks for a team account or GitHub write permission.
    await expect(page.getByText(/team account/i)).toHaveCount(0);
  });
});
