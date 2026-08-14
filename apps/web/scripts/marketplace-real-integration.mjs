import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright-core";

const ROOT_DIR = fileURLToPath(new URL("../../../", import.meta.url));
const API_PORT = Number(process.env.INTEGRATION_API_PORT ?? 3201);
const WEB_PORT = Number(process.env.INTEGRATION_WEB_PORT ?? 3200);
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const RESULT_DIR = path.join(
  ROOT_DIR,
  "apps/web/test-results/marketplace-real-integration",
);

const CUSTOMER = {
  email: "client1@tchuno.local",
  password: "demo1234",
};
const PROVIDER = {
  email: "worker1@tchuno.local",
  password: "demo1234",
};

const originalDatabaseUrl = process.env.DATABASE_URL;
if (!originalDatabaseUrl) {
  throw new Error("DATABASE_URL must be set for real integration tests");
}

const schemaName = `integration_${Date.now()}_${randomUUID().slice(0, 8)}`;
const databaseUrl = new URL(originalDatabaseUrl);
databaseUrl.searchParams.set("schema", schemaName);
const isolatedDatabaseUrl = databaseUrl.toString();
const adminDatabaseUrl = new URL(originalDatabaseUrl);
adminDatabaseUrl.searchParams.delete("schema");

const commonEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: isolatedDatabaseUrl,
  API_PORT: String(API_PORT),
  WEB_ORIGIN: WEB_URL,
  NEXT_PUBLIC_API_URL: API_URL,
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ??
    "integration-access-secret-at-least-32-chars",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ??
    "integration-refresh-secret-at-least-32",
  PAYMENT_DEFAULT_PROVIDER: "INTERNAL",
  THROTTLE_LIMIT: "10000",
  AUTH_REGISTER_THROTTLE_LIMIT: "10000",
  NEXT_TELEMETRY_DISABLED: "1",
};

const children = [];

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    stdio: options.stdio ?? "inherit",
    env: options.env ?? commonEnv,
    shell: false,
  });

  children.push(child);
  return child;
}

function runCommand(command, args, env = commonEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: "inherit",
      env,
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} ${args.join(" ")} exited with code ${code}`),
        );
      }
    });
  });
}

async function waitForHttp(url, label, timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${label} responded ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1000);
  }

  throw new Error(
    `${label} did not become ready in ${timeoutMs}ms: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function apiJson(pathname, options = {}) {
  const response = await fetch(`${API_URL}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `API ${pathname} failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function loginViaUi(page, account, nextPath) {
  const params = new URLSearchParams({
    force: "1",
    next: nextPath,
  });

  await page.goto(`${WEB_URL}/login?${params.toString()}`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${WEB_URL}${nextPath}`, { timeout: 45_000 });
}

async function dropSchema() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: adminDatabaseUrl.toString(),
      },
    },
  });

  try {
    await prisma.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function stopChildren() {
  for (const child of children.reverse()) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  await delay(1000);
}

async function main() {
  await rm(RESULT_DIR, { recursive: true, force: true });
  await mkdir(RESULT_DIR, { recursive: true });

  await runCommand("yarn", [
    "workspace",
    "@tchuno/database",
    "prisma",
    "migrate",
    "deploy",
  ]);
  await runCommand("yarn", [
    "workspace",
    "@tchuno/database",
    "prisma",
    "db",
    "seed",
  ]);

  if (process.env.INTEGRATION_SKIP_BUILD !== "1") {
    await runCommand("yarn", ["workspace", "@tchuno/api", "build"]);
    await runCommand("yarn", ["workspace", "@tchuno/web", "build"]);
  }

  spawnProcess("yarn", ["workspace", "@tchuno/api", "start:prod"]);
  spawnProcess("yarn", [
    "workspace",
    "@tchuno/web",
    "start",
    "--port",
    String(WEB_PORT),
    "--hostname",
    "127.0.0.1",
  ]);

  await waitForHttp(`${API_URL}/observability/ready`, "API readiness");
  await waitForHttp(WEB_URL, "Web");

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const requestTitle = `Integracao V1.2 ${Date.now()}`;

  try {
    await loginViaUi(page, CUSTOMER, "/app/pedidos");
    await page.getByRole("heading", { name: "Pedidos" }).waitFor();
    await page.getByRole("button", { name: "Novo pedido" }).click();

    const createForm = page.locator("form").filter({ hasText: "Criar pedido" });
    await createForm.locator("select").selectOption({ label: "Eletricista" });
    await createForm.locator('input[type="text"]').first().fill(requestTitle);
    await createForm
      .locator("textarea")
      .fill("Teste real V1.2 com browser, API e Postgres.");
    await createForm
      .locator('input[type="text"]')
      .nth(1)
      .fill("Maputo - Polana");
    await createForm.getByRole("button", { name: "Criar pedido" }).click();
    await page.waitForURL(/\/app\/pedidos\/[^/]+$/, { timeout: 45_000 });
    const requestId = page.url().split("/").pop();
    assert.ok(requestId, "request detail URL should include request id");

    await page.getByRole("heading", { name: requestTitle }).waitFor();
    await page.screenshot({
      path: path.join(RESULT_DIR, "01-customer-request-created.png"),
      fullPage: true,
    });

    await loginViaUi(page, PROVIDER, "/pro/pedidos");
    await page.getByRole("heading", { name: "Inbox do prestador" }).waitFor();
    await page.getByText(requestTitle).waitFor({ timeout: 45_000 });

    const providerCard = page.locator("article", { hasText: requestTitle });
    await providerCard.getByRole("button", { name: "Enviar proposta" }).click();
    await providerCard.locator('input[type="number"]').fill("6200");
    await providerCard
      .locator("textarea")
      .fill("Posso executar o servico ainda esta semana.");
    await providerCard
      .getByRole("button", { name: "Confirmar proposta" })
      .click();
    await page.getByText("Proposta enviada com sucesso.").waitFor();
    await page.screenshot({
      path: path.join(RESULT_DIR, "02-provider-proposal-submitted.png"),
      fullPage: true,
    });

    await loginViaUi(page, CUSTOMER, `/app/pedidos/${requestId}`);
    await page.getByText("Posso executar o servico ainda esta semana.").waitFor({
      timeout: 45_000,
    });
    await page.getByRole("button", { name: "Selecionar" }).click();
    await page
      .getByRole("button", { name: "Pagar sinal" })
      .waitFor({ timeout: 45_000 });
    await page.getByRole("button", { name: "Pagar sinal" }).click();
    await page
      .getByText("Pagamento confirmado. Contacto desbloqueado.")
      .waitFor({ timeout: 45_000 });
    await page
      .getByRole("heading", { name: "Contacto desbloqueado" })
      .waitFor();
    await page.getByText("Estado do pagamento: Sinal pago").waitFor();
    await page.screenshot({
      path: path.join(RESULT_DIR, "03-customer-payment-confirmed.png"),
      fullPage: true,
    });

    const customerAuth = await apiJson("/auth/login", {
      method: "POST",
      body: JSON.stringify(CUSTOMER),
    });
    const detail = await apiJson(`/service-requests/${requestId}`, {
      headers: {
        authorization: `Bearer ${customerAuth.accessToken}`,
      },
    });

    assert.equal(detail.status, "CLOSED");
    assert.ok(detail.job?.id, "selection should create a job");
    assert.ok(detail.job?.contactUnlockedAt, "payment should unlock contact");
    assert.equal(detail.job?.paymentIntents?.[0]?.status, "PAID_PARTIAL");
    assert.equal(await page.locator("#avaliacao").count(), 0);
  } finally {
    await browser.close();
  }
}

try {
  await main();
  console.log("Real marketplace integration passed");
} finally {
  await stopChildren();
  await dropSchema();
}
