import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { calculatePlan, DEFAULT_FORM, minimumTilesByArea } from "../lib/planner.js";
import { createPilotBackup } from "../lib/pilot-data.js";

nextEnv.loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const canUseLocalSupabase = Boolean(supabaseUrl && supabaseSecretKey);
const password = "TileLoopE2E!Secure2026";

test("public demo lets visitors inspect a polygon plan without signing in", async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/demo");
    await expect(page.getByText(/Sample L-shaped room/)).toBeVisible();
    await page.getByLabel("Installation pattern").selectOption("diagonal");
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(page.getByRole("img", { name: /Interactive two-dimensional tile cut plan/ })).toBeVisible();
    await page.locator(".plan-2d-piece").first().click();
    await expect(page.locator(".selection-overlay")).toContainText("P-");
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  } finally {
    await page.close();
  }
});

test("a previous browser-local pilot backup can be imported into a private project", async ({ browser }) => {
  test.skip(!canUseLocalSupabase, "Start local Supabase and configure .env.local to run authenticated end-to-end coverage.");

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const email = `tileloop-import-${Date.now()}@example.test`;
  const passwordForImport = "TileLoopE2E!Secure2026";
  let userId;
  let page;

  try {
    const created = await admin.auth.admin.createUser({ email, password: passwordForImport, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user.id;

    page = await browser.newPage();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(passwordForImport);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const form = { ...DEFAULT_FORM, planId: "LEGACY-01", kerf: 0 };
    const plan = calculatePlan(form);
    const usual = plan.orderQuantity;
    const entry = {
      storageVersion: 3,
      id: form.planId,
      room: `${plan.roomWidth} × ${plan.roomLength} mm`,
      tile: `${form.tileWidth} × ${form.tileLength} mm`,
      roomWidth: plan.roomWidth,
      roomLength: plan.roomLength,
      tileWidth: form.tileWidth,
      tileLength: form.tileLength,
      orientation: form.orientation,
      grout: form.grout,
      kerf: 0,
      reserve: form.reserve,
      usual,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    entry.minimumByArea = minimumTilesByArea(plan);
    const backup = createPilotBackup([entry]);
    await page.locator('input[aria-label="Choose an earlier TileLoop JSON backup"]').setInputFiles({
      name: "tileloop-pilot-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(page.getByText("1 backup records are ready to import.")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Import to project" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
    await page.getByText("ROOM PLAN / LEGACY-01").click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/rooms\/[0-9a-f-]+$/);
    await expect(page.getByText("Installer usual")).toBeVisible();
    await expect(page.getByText(`${usual} tiles`)).toHaveCount(2);
  } finally {
    await page?.close();
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});

test("email registration confirms through Supabase and establishes an authenticated session", async ({ browser, request }) => {
  test.skip(!canUseLocalSupabase, "Start local Supabase and configure .env.local to run authenticated end-to-end coverage.");

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const email = `tileloop-signup-${Date.now()}@example.test`;
  let createdUserId;
  let page;

  try {
    page = await browser.newPage();
    await page.goto("/signup");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("status")).toContainText("confirmation link");

    let matchingMessage;
    await expect.poll(async () => {
      const response = await request.get("http://127.0.0.1:54324/api/v1/messages");
      const payload = await response.json();
      matchingMessage = payload.messages.find((message) => message.To.some((recipient) => recipient.Address === email));
      return Boolean(matchingMessage);
    }).toBe(true);

    const messageResponse = await request.get(`http://127.0.0.1:54324/api/v1/message/${matchingMessage.ID}`);
    const message = await messageResponse.json();
    const confirmationLink = message.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(confirmationLink).toBeTruthy();

    await page.goto(confirmationLink);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your tile projects." })).toBeVisible();

    const userLookup = await admin.auth.admin.listUsers();
    createdUserId = userLookup.data.users.find((user) => user.email === email)?.id;
  } finally {
    await page?.close();
    if (!createdUserId) {
      const userLookup = await admin.auth.admin.listUsers();
      createdUserId = userLookup.data.users.find((user) => user.email === email)?.id;
    }
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
  }
});

test("room plans can select a product from the shared supplier catalog", async ({ browser }) => {
  test.setTimeout(60_000);
  test.skip(!canUseLocalSupabase, "Start local Supabase and configure .env.local to run authenticated end-to-end coverage.");

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const runId = Date.now();
  const email = `tileloop-catalog-${runId}@example.test`;
  const catalogCode = `E2E-${runId}`;
  const users = [];
  let page;
  let catalogItemId;

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    users.push(created.data.user.id);

    const catalogRow = await admin.from("catalog_items").insert({
      supplier_key: "e2e-fixture",
      market_code: "AE",
      supplier_code: catalogCode,
      brand: "TileLoop Test Supplier",
      collection_name: "Test Series",
      product_name: "Verified Test Tile",
      color: "White",
      format_label: "600x600mm",
      width_mm: 600,
      height_mm: 600,
      thickness_mm: 9,
      tile_group: "Base",
      body_type: "Porcelain",
      surface_finish: "Matt",
      edge: "Rectified",
      sales_unit: "M2",
      source_captured_at: new Date().toISOString(),
      quality_flags: [],
      catalog_status: "published",
    }).select("id").single();
    expect(catalogRow.error, "catalog fixture setup").toBeNull();
    catalogItemId = catalogRow.data.id;

    page = await browser.newPage();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByLabel("Project name").fill(`Catalog ${runId}`);
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
    const projectId = new URL(page.url()).pathname.split("/").at(-1);
    await page.getByRole("link", { name: "Add room plan" }).click();
    await page.getByLabel("Search supplier catalog").fill(catalogCode);
    await page.getByRole("option", { name: new RegExp(catalogCode) }).click();
    await expect(page.getByLabel("Tile width in millimeters")).toHaveValue("600");
    await page.getByLabel("Room outline").selectOption("l-shape");
    await page.getByRole("button", { name: "Apply L-shape" }).click();
    await page.getByLabel("Installation pattern").selectOption("half-offset");
    await page.getByLabel("Feature X position mm").fill("600");
    await page.getByLabel("Feature Y position mm").fill("600");
    await page.getByRole("button", { name: "Add column / obstacle" }).click();
    await page.getByLabel("Tiles per carton").fill("8");
    await page.getByRole("button", { name: "Save room plan" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/rooms\/[0-9a-f-]+$/);
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(page.getByRole("img", { name: /Interactive two-dimensional tile cut plan/ })).toBeVisible();
    await page.locator(".plan-2d-piece").first().click();
    await expect(page.locator(".selection-overlay")).toContainText("P-");
    await page.getByLabel("Actual tiles used").fill("64");
    await page.getByLabel("Breakage tiles").fill("2");
    await page.getByLabel("Installation time minutes").fill("390");
    await page.getByLabel(/Plan practicality/).selectOption("4");
    await page.getByRole("button", { name: "Save installation outcome" }).click();
    await expect(page.getByRole("status")).toContainText("Actual installation outcome saved");
    const exportResponse = await page.context().request.get(`${new URL(page.url()).origin}/api/export`);
    expect(exportResponse.status()).toBe(200);
    const exportData = await exportResponse.json();
    const savedSnapshot = exportData.projects[0].room_plans[0].plan_snapshots[0];
    expect(savedSnapshot.inputs.roomGeometry.schema).toBe("tileloop-room-geometry/v2");
    expect(savedSnapshot.inputs.roomGeometry.zones[0].boundary).toHaveLength(6);
    expect(savedSnapshot.inputs.roomGeometry.zones[0].obstacles).toHaveLength(1);
    expect(savedSnapshot.inputs.layout.pattern).toBe("half-offset");
    expect(savedSnapshot.result_summary.pieces.some((piece) => piece.shape === "polygon")).toBe(true);
    expect(savedSnapshot.result_summary.cartonsToOrder).toBeGreaterThan(0);
    const outcome = Array.isArray(savedSnapshot.installation_outcomes) ? savedSnapshot.installation_outcomes[0] : savedSnapshot.installation_outcomes;
    expect(outcome.actual_tiles_used).toBe(64);
    expect(outcome.breakage_tiles).toBe(2);
    await page.getByRole("link", { name: "Evaluation" }).click();
    await expect(page.getByRole("heading", { name: "Pilot evaluation." })).toBeVisible();
    await expect(page.getByText(/Catalog .* · ROOM-01/)).toBeVisible();
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText(new RegExp(`TileLoop Test Supplier · Test Series · ${catalogCode}`))).toBeVisible();
  } finally {
    try { await page?.close(); } catch { /* The runner may already have disposed the page after a timeout. */ }
    if (users.length) await admin.auth.admin.deleteUser(users[0]);
    if (catalogItemId) await admin.from("catalog_items").delete().eq("id", catalogItemId);
  }
});

test("a private user creates, versions, exports, and deletes a project", async ({ browser }) => {
  test.skip(!canUseLocalSupabase, "Start local Supabase and configure .env.local to run authenticated end-to-end coverage.");

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const ownerEmail = `tileloop-owner-${runId}@example.test`;
  const strangerEmail = `tileloop-stranger-${runId}@example.test`;
  const users = [];
  let projectId;
  let owner;
  let stranger;

  try {
    for (const email of [ownerEmail, strangerEmail]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(error, "test user setup").toBeNull();
      users.push(data.user.id);
    }

    owner = await browser.newPage();
    await owner.goto("/login");
    await owner.getByLabel("Email address").fill(ownerEmail);
    await owner.getByLabel("Password", { exact: true }).fill(password);
    await owner.getByRole("button", { name: "Sign in" }).click();
    await expect(owner).toHaveURL(/\/dashboard$/);

    await owner.getByLabel("Project name").fill(`Acceptance ${runId}`);
    await owner.getByRole("button", { name: "Create project" }).click();
    await expect(owner).toHaveURL(/\/projects\/[0-9a-f-]+$/);
    projectId = new URL(owner.url()).pathname.split("/").at(-1);

    await owner.getByRole("link", { name: "Add room plan" }).click();
    await owner.getByLabel(/Installer estimate/).fill("72");
    await owner.getByLabel(/Comparison note/).fill("Matched site dimensions and tile stock.");
    await expect(owner.getByLabel(/Installer estimate/)).toHaveValue("72");
    await owner.getByRole("button", { name: "Save room plan" }).click();
    await expect(owner).toHaveURL(new RegExp(`/projects/${projectId}/rooms/[0-9a-f-]+$`));
    await expect(owner.getByText("straight-lay-kerf-1")).toBeVisible();

    const firstExportResponse = await owner.context().request.get(`${new URL(owner.url()).origin}/api/export`);
    expect(firstExportResponse.status()).toBe(200);
    const firstExport = await firstExportResponse.json();
    const firstSnapshot = firstExport.projects[0].room_plans[0].plan_snapshots[0];
    expect(firstSnapshot.installer_comparisons.installer_estimate_tiles).toBe(72);
    expect(firstSnapshot.inputs.roomGeometry.schema).toBe("tileloop-room-geometry/v2");
    expect(firstSnapshot.inputs.layout).toMatchObject({ pattern: "straight", alignment: "centered", orientation: "standard" });
    await expect(owner.getByText(/Installer usual/)).toBeVisible();

    await owner.getByLabel(/Saw kerf/).fill("4");
    await expect(owner.getByLabel(/Installer estimate/)).toHaveValue("");
    await owner.getByRole("button", { name: "Save new calculation version" }).click();
    await expect(owner.getByText("2 saved versions")).toBeVisible();

    const exportResponse = await owner.context().request.get(`${new URL(owner.url()).origin}/api/export`);
    expect(exportResponse.status()).toBe(200);
    const exportData = await exportResponse.json();
    expect(exportData.schema).toBe("tileloop-account-export/v1");
    expect(exportData.projects).toHaveLength(1);
    const exportedSnapshots = exportData.projects[0].room_plans[0].plan_snapshots;
    expect(exportedSnapshots).toHaveLength(2);
    expect(exportedSnapshots[0].installer_comparisons.installer_estimate_tiles).toBe(72);

    stranger = await browser.newPage();
    await stranger.goto("/login");
    await stranger.getByLabel("Email address").fill(strangerEmail);
    await stranger.getByLabel("Password", { exact: true }).fill(password);
    await stranger.getByRole("button", { name: "Sign in" }).click();
    await expect(stranger).toHaveURL(/\/dashboard$/);
    await stranger.goto(`/projects/${projectId}`);
    await expect(stranger.getByText("Page not found.")).toBeVisible();

    await owner.goto(`/projects/${projectId}`);
    owner.once("dialog", (dialog) => dialog.accept());
    await owner.getByRole("button", { name: "Delete project" }).click();
    await expect(owner).toHaveURL(/\/dashboard$/);
    await expect(owner.getByText(`Acceptance ${runId}`)).toHaveCount(0);

    await owner.goto("/account");
    await owner.getByLabel("Type DELETE to confirm").fill("DELETE");
    await owner.getByLabel("Current password").fill(password);
    await owner.getByRole("button", { name: "Delete account and all project data" }).click();
    await expect(owner).toHaveURL(/\/account\/deleted$/);
    await expect(owner.getByRole("heading", { name: "Account deleted." })).toBeVisible();
  } finally {
    await owner?.close();
    await stranger?.close();
    for (const userId of users) await admin.auth.admin.deleteUser(userId);
  }
});
