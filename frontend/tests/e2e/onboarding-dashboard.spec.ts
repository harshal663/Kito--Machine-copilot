import { test, expect } from "@playwright/test";
import * as path from "path";

const SCREENS_DIR = path.resolve(__dirname, "../../../docs/screens");

test.describe("Full Onboarding, Dashboard, SSE, and Shell Flow", () => {
  const timestamp = Date.now();
  const testEmail = `owner_${timestamp}@example.com`;
  const testPassword = "SecurePassword123!";
  const testName = "Aditya Sharma";

  test("End-to-End Walkthrough: Auth, 4-Step Onboarding, Handover, Dashboard, Shell & Themes", async ({
    page,
  }) => {
    // ----------------------------------------------------
    // Sign-in page screenshots (1280px & 375px, Light & Dark)
    // ----------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sign-in");
    await expect(page.locator("h2")).toContainText("Sign in to Machine Copilot");

    // Light 1280px
    await page.screenshot({ path: path.join(SCREENS_DIR, "sign-in-light-1280px.png"), fullPage: true });

    // Dark 1280px
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "sign-in-dark-1280px.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    // 375px mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: path.join(SCREENS_DIR, "sign-in-light-375px.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "sign-in-dark-375px.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    // ----------------------------------------------------
    // Step 5a: Sign up as a new owner -> land on /onboarding/personal
    // ----------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sign-up");
    await expect(page.locator("h2")).toContainText("Create an owner account");

    await page.fill("#fullName", testName);
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/onboarding\/personal/);

    // ----------------------------------------------------
    // Step 5b: Complete 4 Onboarding Steps
    // ----------------------------------------------------
    // Step 1: Personal Details
    await expect(page.locator("text=Step 1: Personal Details")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step1-personal-light-1280px.png") });

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step1-personal-dark-1280px.png") });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step1-personal-light-375px.png") });
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.fill("#phone", "+919876543210");
    await page.selectOption("#language", "en");
    await page.click('button[type="submit"]');

    // Step 2: Factory Details
    await expect(page).toHaveURL(/\/onboarding\/factory/);
    await expect(page.locator("text=Step 2: Factory Details")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step2-factory-light-1280px.png") });

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step2-factory-dark-1280px.png") });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step2-factory-light-375px.png") });
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.fill("#factoryName", "Apex Precision Engineering Plant 1");
    await page.selectOption("#industry", "metal_machining");
    await page.fill("#addressLine", "Plot 42, MIDC Industrial Area Phase 2");
    await page.fill("#city", "Pune");
    await page.fill("#state", "Maharashtra");
    await page.fill("#pincode", "411019");
    await page.selectOption("#employeeBand", "11-25");
    await page.fill("#gstin", "27AAAAA0000A1Z5");
    await page.click('button[type="submit"]');

    // Step 3: Machines Setup
    await expect(page).toHaveURL(/\/onboarding\/machines/);
    await expect(page.locator("text=Step 3: Register Machinery")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step3-machines-light-1280px.png") });

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step3-machines-dark-1280px.png") });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step3-machines-light-375px.png") });
    await page.setViewportSize({ width: 1280, height: 800 });

    // Add first machine
    await page.fill("#machineName", "CNC Main Spindle Motor #1");
    await page.selectOption("#machineType", "motor");
    await page.fill("#ratedRpm", "1450");
    await page.fill("#supName", "Ramesh Patel");
    await page.fill("#supPhone", "+919876543211");
    await page.click("text=Add Machine to Fleet");

    // Wait for machine to appear in list
    await expect(page.locator("text=CNC Main Spindle Motor #1")).toBeVisible();

    // Click continue to review
    await page.click("text=Continue to Review →");

    // Step 4: Review & Finalize
    await expect(page).toHaveURL(/\/onboarding\/review/);
    await expect(page.locator("text=Step 4: Review & Finalize")).toBeVisible();
    await expect(page.locator("text=Apex Precision Engineering Plant 1")).toBeVisible();
    await expect(page.locator("text=CNC Main Spindle Motor #1")).toBeVisible();

    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step4-review-light-1280px.png") });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step4-review-dark-1280px.png") });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-step4-review-light-375px.png") });
    await page.setViewportSize({ width: 1280, height: 800 });

    // Finish Onboarding -> Handover Dialog
    await page.click("text=Finish & Activate Dashboard");
    await expect(page.locator("text=Device Key Generated")).toBeVisible();
    await expect(page.locator("text=Save this key now!")).toBeVisible();

    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-device-key-dialog-light-1280px.png") });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "onboarding-device-key-dialog-dark-1280px.png") });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    // Check acknowledgement and enter dashboard
    await page.check("#ack-key");
    await page.click("text=Enter Dashboard →");

    // Land on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("text=Machinery Fleet Status")).toBeVisible();

    // Dashboard screenshots
    await page.screenshot({ path: path.join(SCREENS_DIR, "dashboard-fleet-light-1280px.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "dashboard-fleet-dark-1280px.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    // ----------------------------------------------------
    // Step 5c: Sign out, then sign in with same account -> land on dashboard
    // ----------------------------------------------------
    await page.click('button[aria-label="Open user menu"]');
    await page.click("text=Sign out");
    await expect(page).toHaveURL(/\/sign-in/);

    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);

    // ----------------------------------------------------
    // Step 5e: Live indicator visible
    // ----------------------------------------------------
    await expect(page.locator('[role="status"]')).toBeVisible();

    // ----------------------------------------------------
    // Step 5g: Theme toggle
    // ----------------------------------------------------
    const themeBtn = page.locator('button[aria-label="Toggle theme color scheme"]');
    await themeBtn.click();
    await page.waitForTimeout(300);
    // Click again to toggle back
    await themeBtn.click();
    await page.waitForTimeout(300);

    // ----------------------------------------------------
    // Step 5h: Mobile hamburger at 375px width closes on navigation
    // ----------------------------------------------------
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: path.join(SCREENS_DIR, "dashboard-fleet-light-375px.png") });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "dashboard-fleet-dark-375px.png") });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    const mobileMenuBtn = page.locator('button[aria-label="Open navigation menu"]');
    await expect(mobileMenuBtn).toBeVisible();
    await mobileMenuBtn.click();

    // Verify drawer open
    const drawerNav = page.locator('[role="dialog"] nav[aria-label="Main Navigation"]');
    await expect(drawerNav).toBeVisible();
    await page.screenshot({ path: path.join(SCREENS_DIR, "mobile-sidebar-light-375px.png") });

    // Navigate to Machines
    await page.locator('[role="dialog"] a[href="/machines"]').click();
    await expect(page).toHaveURL(/\/machines/);
    // Verify drawer closed
    await expect(drawerNav).not.toBeVisible();

    // ----------------------------------------------------
    // Step 5i: Profile menu sign out
    // ----------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    await page.click('button[aria-label="Open user menu"]');
    await expect(page.locator("text=Sign out")).toBeVisible();
    await page.click("text=Sign out");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("Empty State, Simulator Telemetry Fault, SSE Live Update & Decision Flow", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const emptyEmail = `owner_empty_${timestamp}@example.com`;
    const password = "SecurePassword123!";

    // Clear previous sessions
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 1. Register new owner
    await page.goto("/sign-up");
    await page.fill("#fullName", "Vikram Malhotra");
    await page.fill("#email", emptyEmail);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/onboarding\/personal/);

    // Personal details
    await page.fill("#phone", "+919876543222");
    await page.click('button[type="submit"]');

    // Factory details
    await expect(page).toHaveURL(/\/onboarding\/factory/);
    await page.fill("#factoryName", "Malhotra Heavy Engineering");
    await page.fill("#addressLine", "Sector 7 GIDC");
    await page.fill("#city", "Ahmedabad");
    await page.fill("#state", "Gujarat");
    await page.fill("#pincode", "380001");
    await page.click('button[type="submit"]');

    // Machines Setup -> Skip adding machine for empty state verification
    await expect(page).toHaveURL(/\/onboarding\/machines/);
    await expect(page.locator("text=No machines added yet")).toBeVisible();
    await page.click("button:has-text('Add later')");
    await expect(page.locator("text=Skip adding machines for now?")).toBeVisible();
    await page.click("button:has-text('Yes, skip to review')");

    // Review step
    await expect(page).toHaveURL(/\/onboarding\/review/);
    await expect(page.locator("text=Machinery registration skipped")).toBeVisible();
    await page.click("button:has-text('Finish & Activate Dashboard')");

    // Land on empty dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("text=No machinery registered yet")).toBeVisible();

    // Capture empty state screenshots
    await page.screenshot({ path: path.join(SCREENS_DIR, "dashboard-empty-light-1280px.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCREENS_DIR, "dashboard-empty-dark-1280px.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    // 2. Add machine from empty state (Step 5d)
    await page.click("text=Register First Machine");
    await expect(page).toHaveURL(/\/machines\/new/);

    await page.fill("#name", "Cooling Tower Fan #3");
    await page.fill("#machine_type", "fan");
    await page.fill("#rated_rpm", "980");
    await page.fill("#supervisor_name", "Karan Mehta");
    await page.fill("#supervisor_phone", "+919876543233");
    await page.click('button[type="submit"]');

    // Wait for machine detail page
    await expect(page).toHaveURL(/\/machines\/mch_/);
    const machineUrl = page.url();
    const machineId = machineUrl.split("/").pop() || "";
    expect(machineId).toMatch(/^mch_/);

    // 3. Bind sensor node device
    await page.click("button:has-text('Bind Sensor Node')");
    await expect(page.locator("h3:has-text('Bind Sensor Node')")).toBeVisible();
    await page.click("button:has-text('Generate Device Key')");

    // Wait for device credentials
    await expect(page.locator("text=Store Device Key Securely")).toBeVisible();
    const deviceIdText = (await page.getByTestId("device-id").textContent())?.trim() ?? "";
    const deviceKeyText = (await page.getByTestId("device-key").textContent())?.trim() ?? "";

    expect(deviceIdText).toMatch(/^dev_/);
    expect(deviceKeyText).toBeTruthy();

    await page.click("button:has-text('Done')");

    // 4. Run simulator with fault (Step 5d)
    const { execSync } = await import("child_process");
    const pythonExe = path.resolve(__dirname, "../../../backend/.venv/Scripts/python.exe");
    const simulatorScript = path.resolve(__dirname, "../../../simulator/simulate_device.py");

    const simCmd = `"${pythonExe}" "${simulatorScript}" --api-url http://127.0.0.1:8000 --device-id "${deviceIdText}" --device-key "${deviceKeyText}" --machine-id "${machineId}" --fault imbalance --count 2`;
    execSync(simCmd, { stdio: "inherit" });

    // 5. Navigate to Dashboard and observe live SSE alert (Step 5e)
    await page.goto("/dashboard");
    await expect(page.locator("text=Open alerts")).toBeVisible();
    await expect(page.locator('[role="status"]')).toContainText("Live");

    // Wait for the anomaly alert to appear in recent alerts
    const alertRow = page.locator(`a[href*="/events/evt_"]`).first();
    await expect(alertRow).toBeVisible({ timeout: 15_000 });

    // 6. Click on alert, record decision, verify status change (Step 5f)
    await alertRow.click();
    await expect(page).toHaveURL(/\/events\/evt_/);
    await expect(page.locator("text=Vibration Anomaly Event")).toBeVisible();

    // Click "Acknowledge" decision
    const ackButton = page.locator("button:has-text('Acknowledge')");
    await expect(ackButton).toBeVisible();
    await ackButton.click();

    // Verify status changes to ACKNOWLEDGED on screen
    await expect(page.locator("text=Decision Recorded")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=ACKNOWLEDGED").first()).toBeVisible();
  });
});
