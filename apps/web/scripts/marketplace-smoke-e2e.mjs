import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT_DIR = fileURLToPath(new URL("../../../", import.meta.url));
const WEB_PORT = Number(process.env.SMOKE_WEB_PORT ?? 3105);
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const SMOKE_SCREENSHOT_DIR = path.join(
  ROOT_DIR,
  "apps/web/test-results/marketplace-smoke",
);

const TOKENS = {
  customer: "smoke-customer-token",
  provider: "smoke-provider-token",
  admin: "smoke-admin-token",
};

const now = new Date();

const corsHeaders = {
  "access-control-allow-origin": WEB_URL,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "content-type": "application/json",
};

const categories = [
  {
    id: "cat-eletricista",
    name: "Eletricista",
    slug: "eletricista",
    description: "Serviços de eletricista",
    sortOrder: 10,
    isActive: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  },
  {
    id: "cat-canalizacao",
    name: "Canalização",
    slug: "canalizacao",
    description: "Serviços de canalização",
    sortOrder: 20,
    isActive: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  },
];

const workerProfile = {
  id: "wp-provider-1",
  userId: "provider-1",
  bio: "Prestador especializado em eletricidade residencial.",
  location: "Maputo",
  hourlyRate: 1500,
  experienceYears: 6,
  isAvailable: true,
  ratingAvg: "4.70",
  ratingCount: 18,
  categories: [
    {
      id: "cat-eletricista",
      name: "Eletricista",
      slug: "eletricista",
    },
  ],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

const customerServiceRequests = [
  {
    id: "req-1",
    customerId: "customer-1",
    categoryId: "cat-eletricista",
    title: "Reparar curto-circuito",
    description: "Preciso de reparação do quadro elétrico.",
    location: "Maputo",
    status: "OPEN",
    selectedProposalId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    proposals: [],
    job: null,
  },
  {
    id: "req-2",
    customerId: "customer-1",
    categoryId: "cat-canalizacao",
    title: "Troca de torneira",
    description: "Substituir torneira da cozinha.",
    location: "Matola",
    status: "CLOSED",
    selectedProposalId: "prop-2",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    proposals: [
      {
        id: "prop-2",
        providerId: "provider-1",
        price: 4200,
        status: "SELECTED",
        createdAt: now.toISOString(),
      },
    ],
    job: {
      id: "job-2",
      status: "REQUESTED",
      contactUnlockedAt: null,
      agreedPrice: 4200,
    },
  },
];

const openServiceRequests = [
  {
    id: "req-open-1",
    customerId: "customer-2",
    categoryId: "cat-eletricista",
    title: "Instalação de disjuntor",
    description: "Preciso substituir disjuntor principal.",
    location: "Maputo",
    status: "OPEN",
    selectedProposalId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    proposals: [
      {
        id: "prop-own-1",
        providerId: "provider-1",
        price: 5500,
        status: "SUBMITTED",
        createdAt: now.toISOString(),
      },
    ],
  },
];

const customerPaymentIntents = [
  {
    id: "pi-1",
    jobId: "job-2",
    customerId: "customer-1",
    providerUserId: "provider-1",
    amount: 1260,
    currency: "MZN",
    platformFeeAmount: 189,
    providerNetAmount: 1071,
    status: "PAID_PARTIAL",
    provider: "INTERNAL",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    transactions: [],
  },
];

const adminPaymentTransactions = [
  {
    id: "ptx-1",
    paymentIntentId: "pi-1",
    type: "CHARGE",
    status: "PENDING",
    provider: "INTERNAL",
    providerReference: "prov-ref-1",
    requestedAmount: 1260,
    confirmedAmount: null,
    currency: "MZN",
    failureReason: null,
    processedAt: null,
    createdAt: now.toISOString(),
  },
];

const adminRefunds = [
  {
    id: "refund-1",
    jobId: "job-2",
    paymentIntentId: "pi-1",
    transactionId: "ptx-1",
    requestedByUserId: "admin-1",
    approvedByUserId: null,
    amount: 300,
    currency: "MZN",
    reason: "Ajuste operacional",
    status: "PENDING",
    provider: "INTERNAL",
    providerReference: null,
    processedAt: null,
    failureReason: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  },
];

const adminPayouts = [
  {
    id: "payout-1",
    providerUserId: "provider-1",
    jobId: "job-2",
    paymentIntentId: "pi-1",
    amount: 1071,
    currency: "MZN",
    status: "PENDING",
    provider: "INTERNAL",
    providerReference: null,
    requestedByUserId: "admin-1",
    approvedByUserId: null,
    processedAt: null,
    failureReason: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  },
];

const adminPaymentsOverview = {
  kpis: {
    totalIntents: 1,
    intentsAwaitingPayment: 0,
    intentsSucceeded: 0,
    intentsFailed: 0,
    totalTransactions: 1,
    failedTransactions: 0,
    pendingRefunds: 1,
    pendingPayouts: 1,
    platformReserved: 189,
    providerHeld: 1071,
    providerAvailable: 0,
    releaseDelayHours: 24,
  },
};

const providerSummary = {
  balances: {
    held: 1071,
    available: 0,
    paidOut: 0,
  },
  entries: [
    {
      id: "le-1",
      entryType: "PROVIDER_BALANCE_HELD",
      amount: 1071,
      direction: "CREDIT",
      bucket: "PROVIDER_HELD",
      createdAt: now.toISOString(),
      paymentIntentId: "pi-1",
      jobId: "job-2",
      description: "Provider net amount moved to held balance",
    },
  ],
  payouts: [],
};

function paginated(data, page = 1, limit = 20) {
  return {
    data,
    meta: {
      total: data.length,
      page,
      limit,
      hasNext: false,
    },
  };
}

function resolveAuthProfile(request) {
  const authHeader = request.headers()["authorization"] ?? "";

  if (authHeader === `Bearer ${TOKENS.admin}`) {
    return "admin";
  }

  if (authHeader === `Bearer ${TOKENS.provider}`) {
    return "provider";
  }

  if (authHeader === `Bearer ${TOKENS.customer}`) {
    return "customer";
  }

  return "public";
}

function resolveMockBody(url, request) {
  const profile = resolveAuthProfile(request);

  if (url.pathname === "/auth/me") {
    if (profile === "admin") {
      return {
        user: {
          id: "admin-1",
          email: "admin@tchuno.local",
          name: "Smoke Admin",
          role: "ADMIN",
        },
        access: {
          appRole: "admin",
        },
      };
    }

    if (profile === "provider") {
      return {
        user: {
          id: "provider-1",
          email: "provider@tchuno.local",
          name: "Smoke Provider",
          role: "USER",
        },
        access: {
          appRole: "provider",
        },
      };
    }

    if (profile === "customer") {
      return {
        user: {
          id: "customer-1",
          email: "customer@tchuno.local",
          name: "Smoke Customer",
          role: "USER",
        },
        access: {
          appRole: "customer",
        },
      };
    }

    return {
      user: {
        id: "guest",
        email: "guest@tchuno.local",
        name: "Guest",
        role: "USER",
      },
      access: {
        appRole: "guest",
      },
    };
  }

  if (url.pathname === "/auth/sessions") {
    return {
      data: [
        {
          id: "session-1",
          deviceId: "smoke-device",
          ip: "127.0.0.1",
          userAgent: "Smoke Browser",
          createdAt: now.toISOString(),
          lastUsedAt: now.toISOString(),
          revokedAt: null,
        },
      ],
      meta: {
        total: 1,
        limit: 20,
        offset: 0,
        page: 1,
        pageCount: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  if (url.pathname === "/categories") {
    return categories;
  }

  if (url.pathname === "/worker-profile") {
    return paginated([workerProfile], 1, 20);
  }

  if (url.pathname === "/worker-profile/me") {
    return workerProfile;
  }

  if (url.pathname.startsWith("/worker-profile/")) {
    return workerProfile;
  }

  if (url.pathname === "/service-requests/me") {
    return paginated(customerServiceRequests, 1, 20);
  }

  if (url.pathname === "/service-requests/open") {
    return paginated(openServiceRequests, 1, 20);
  }

  if (url.pathname.endsWith("/proposals") && request.method() === "GET") {
    return [
      {
        id: "prop-2",
        requestId: "req-2",
        providerId: "provider-1",
        price: 4200,
        comment: "Posso executar amanhã.",
        status: "SELECTED",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        provider: {
          id: "provider-1",
          name: "Smoke Provider",
          workerProfile: {
            ratingAvg: "4.70",
            ratingCount: 18,
            location: "Maputo",
          },
        },
      },
    ];
  }

  if (url.pathname === "/payments/me") {
    return paginated(customerPaymentIntents, 1, 20);
  }

  if (url.pathname === "/payments/provider/summary") {
    return providerSummary;
  }

  if (url.pathname === "/admin/payments/overview") {
    return adminPaymentsOverview;
  }

  if (url.pathname === "/admin/payments/intents") {
    return paginated(customerPaymentIntents, 1, 20);
  }

  if (url.pathname === "/admin/payments/transactions") {
    return paginated(adminPaymentTransactions, 1, 20);
  }

  if (url.pathname === "/admin/payments/refunds") {
    return paginated(adminRefunds, 1, 20);
  }

  if (url.pathname === "/admin/payments/payouts") {
    return paginated(adminPayouts, 1, 20);
  }

  if (url.pathname === "/admin/ops/overview") {
    return {
      kpis: {
        totalJobs: 2,
        jobsByStatus: {
          REQUESTED: 1,
          ACCEPTED: 1,
          IN_PROGRESS: 0,
          COMPLETED: 0,
          CANCELED: 0,
        },
        completionRate: 0,
        totalReviews: 0,
        averageRating: 0,
        activePublicableWorkers: 1,
        jobsByPricingMode: {
          FIXED_PRICE: 2,
          QUOTE_REQUEST: 0,
        },
      },
      recentJobs: [],
      recentlyCanceledJobs: [],
      completedWithoutReviewJobs: [],
    };
  }

  if (url.pathname === "/reviews/me") {
    return paginated([], 1, 20);
  }

  if (url.pathname.startsWith("/reviews/worker/")) {
    return paginated([], 1, 20);
  }

  if (url.pathname === "/jobs/me/client") {
    return paginated([], 1, 20);
  }

  if (url.pathname === "/jobs/me/worker") {
    return paginated([], 1, 20);
  }

  if (url.pathname === "/tracking/ranking/workers") {
    return paginated([], 1, 20);
  }

  return {};
}

function startWebServer() {
  const child = spawn(
    "yarn",
    ["workspace", "@tchuno/web", "start", "--port", String(WEB_PORT)],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: "pipe",
    },
  );

  const logs = [];
  const track = (chunk) => {
    const text = chunk.toString();
    logs.push(text);
    process.stdout.write(text);
    if (logs.length > 40) {
      logs.shift();
    }
  };

  child.stdout.on("data", track);
  child.stderr.on("data", track);

  return { child, getLogs: () => logs.join("") };
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
    });
  });
}

async function waitForWebReady(getLogs) {
  const timeoutAt = Date.now() + 90_000;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(`${WEB_URL}/`);
      if (response.ok) {
        return;
      }
    } catch {
      // server still booting
    }

    await delay(500);
  }

  throw new Error(`Web server did not start in time.\n${getLogs()}`);
}

function routePathToScreenshotName(routePath) {
  const [pathPart, queryPart] = routePath.split("?");
  const normalizedPath = pathPart.replace(/^\/+/, "").replaceAll("/", "-");
  const base = normalizedPath.length > 0 ? normalizedPath : "landing";

  if (!queryPart) {
    return base;
  }

  const normalizedQuery = queryPart.replace(/[^a-z0-9]+/gi, "-");
  return `${base}--${normalizedQuery}`;
}

async function hasRoleWithName(page, role, name) {
  try {
    await page.getByRole(role, { name }).first().waitFor({ timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

async function assertA11yBasics(page, check, viewportName) {
  const mainCount = await page.locator("main").count();
  assert(mainCount >= 1, `${viewportName} ${check.path} sem landmark <main>`);

  const h1Count = await page.getByRole("heading", { level: 1 }).count();
  assert(h1Count === 1, `${viewportName} ${check.path} deve ter um único <h1>`);

  const hasButtonCta = await hasRoleWithName(page, "button", check.cta);
  const hasLinkCta = await hasRoleWithName(page, "link", check.cta);
  assert(
    hasButtonCta || hasLinkCta,
    `${viewportName} ${check.path} sem ação principal acessível por role`,
  );

  const unlabeledControls = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll("input, select, textarea"));

    return controls.filter((element) => {
      const type = element.getAttribute("type");
      if (type === "hidden") {
        return false;
      }

      const hasWrappedLabel = Boolean(element.closest("label"));
      const id = element.getAttribute("id");
      const hasForLabel = id
        ? Boolean(document.querySelector(`label[for="${id}"]`))
        : false;
      const hasAria =
        Boolean(element.getAttribute("aria-label")) ||
        Boolean(element.getAttribute("aria-labelledby"));

      return !hasWrappedLabel && !hasForLabel && !hasAria;
    }).length;
  });

  assert(
    unlabeledControls === 0,
    `${viewportName} ${check.path} possui campos sem label acessível`,
  );
}

async function assertRouteSpecificContent(page, check, viewportName) {
  if (!Array.isArray(check.mustHave)) {
    return;
  }

  for (const requirement of check.mustHave) {
    if (requirement.type === "text") {
      await page.getByText(requirement.value, { exact: false }).first().waitFor({
        timeout: 20_000,
      });
      continue;
    }

    if (requirement.type === "label") {
      await page.getByLabel(requirement.value).first().waitFor({
        timeout: 20_000,
      });
      continue;
    }

    if (requirement.type === "aria") {
      const ariaCount = await page
        .locator(`[aria-label="${requirement.value}"]`)
        .count();
      assert(
        ariaCount >= 1,
        `${viewportName} ${check.path} sem elemento aria-label="${requirement.value}"`,
      );
    }
  }
}

function seedAuthStorage(profile) {
  if (profile === "public") {
    return {
      accessToken: null,
      refreshToken: null,
    };
  }

  return {
    accessToken: TOKENS[profile],
    refreshToken: `${TOKENS[profile]}-refresh`,
  };
}

async function run() {
  await runCommand("yarn", ["workspace", "@tchuno/web", "build"]);

  const { child, getLogs } = startWebServer();

  try {
    await waitForWebReady(getLogs);
    await rm(SMOKE_SCREENSHOT_DIR, { recursive: true, force: true });
    await mkdir(SMOKE_SCREENSHOT_DIR, { recursive: true });

    const browser = await chromium.launch({
      headless: true,
      executablePath: CHROME_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const checks = [
        {
          path: "/",
          auth: "public",
          heading: "O que precisas hoje?",
          block: "Profissionais em destaque",
          cta: /Encontrar profissional|Entrar no Tchuno/,
          mustHave: [
            { type: "label", value: "Pesquisa principal" },
            { type: "aria", value: "Categorias" },
            { type: "text", value: "Profissionais em destaque" },
          ],
        },
        {
          path: "/prestadores",
          auth: "public",
          heading: "Profissionais",
          block: "Pesquisa por serviço, área ou profissional",
          cta: /Procurar/,
          mustHave: [
            { type: "label", value: "Pesquisa" },
            { type: "label", value: "Área" },
            {
              type: "text",
              value:
                "No Tchuno, o cliente cria pedido, recebe propostas e paga sinal antes do contacto",
            },
          ],
        },
        {
          path: "/app/pedidos",
          auth: "customer",
          heading: "Pedidos de Serviço",
          block: "Sem sinal, sem contacto",
          cta: /Criar pedido|Recarregar/,
          mustHave: [
            { type: "label", value: "Categoria" },
            { type: "label", value: "Título" },
          ],
        },
        {
          path: "/app/pagamentos",
          auth: "customer",
          heading: "Pagamentos",
          block: "Acompanha o estado financeiro",
          cta: /Ver pedidos/,
          mustHave: [{ type: "text", value: "Total pago" }],
        },
        {
          path: "/pro/pedidos",
          auth: "provider",
          heading: "Pedidos Disponíveis",
          block: "Propor -> esperar seleção",
          cta: /Enviar proposta/,
          mustHave: [{ type: "label", value: "Preço proposto (MZN)" }],
        },
        {
          path: "/pro/ganhos",
          auth: "provider",
          heading: "Ganhos",
          block: "Controla saldos retidos",
          cta: /Ver pedidos/,
          mustHave: [{ type: "text", value: "Saldo disponível" }],
        },
        {
          path: "/pro/propostas",
          auth: "provider",
          heading: "Propostas",
          block: "Histórico das tuas propostas",
          cta: /Ver pedido aberto/,
        },
        {
          path: "/admin/payments",
          auth: "admin",
          heading: "Operação de Pagamentos",
          block: "Monitoriza intents",
          cta: /Reconciliar pendentes em lote/,
        },
        {
          path: "/admin/users",
          auth: "admin",
          heading: "Users",
          block: "utilizadores com atividade financeira",
          cta: /Abrir payments/,
        },
        {
          path: "/admin/audit",
          auth: "admin",
          heading: "Audit",
          block: "Eventos recentes de transações",
          cta: /Abrir payments/,
        },
      ];

      const viewports = [
        {
          name: "desktop",
          viewport: { width: 1366, height: 900 },
        },
        {
          name: "mobile",
          viewport: { width: 390, height: 844 },
        },
      ];

      for (const viewportConfig of viewports) {
        for (const check of checks) {
          console.log(`Smoke ${viewportConfig.name}: ${check.path}`);

          const context = await browser.newContext({
            viewport: viewportConfig.viewport,
          });

          const seededTokens = seedAuthStorage(check.auth);
          await context.addInitScript((tokens) => {
            localStorage.removeItem("tchuno_access_token");
            localStorage.removeItem("tchuno_refresh_token");
            localStorage.setItem("tchuno_device_id", "smoke-device");

            if (tokens?.accessToken) {
              localStorage.setItem("tchuno_access_token", tokens.accessToken);
            }

            if (tokens?.refreshToken) {
              localStorage.setItem("tchuno_refresh_token", tokens.refreshToken);
            }
          }, seededTokens);

          await context.route(
            /http:\/\/(localhost|127\.0\.0\.1):3001\/.*/,
            async (route) => {
              const request = route.request();
              const url = new URL(request.url());

              if (request.method() === "OPTIONS") {
                await route.fulfill({
                  status: 204,
                  headers: corsHeaders,
                  body: "",
                });
                return;
              }

              const body = resolveMockBody(url, request);
              await route.fulfill({
                status: 200,
                headers: corsHeaders,
                body: JSON.stringify(body),
              });
            },
          );

          const page = await context.newPage();
          await page.goto(`${WEB_URL}${check.path}`, {
            waitUntil: "networkidle",
          });

          await page
            .getByRole("heading", { level: 1, name: check.heading })
            .waitFor({ timeout: 20_000 });

          await page.getByText(check.block, { exact: false }).first().waitFor({
            timeout: 20_000,
          });

          await page.getByText(check.cta).first().waitFor({
            timeout: 20_000,
          });

          await assertA11yBasics(page, check, viewportConfig.name);
          await assertRouteSpecificContent(page, check, viewportConfig.name);

          const bodyText = await page.locator("body").innerText();
          assert(
            !bodyText.includes("Status: Failed to fetch"),
            `${viewportConfig.name} ${check.path} apresentou erro de fetch`,
          );
          assert(
            !bodyText.includes("Sessão inválida"),
            `${viewportConfig.name} ${check.path} apresentou erro de sessão inválida`,
          );
          assert(
            !bodyText.includes("Permissão insuficiente."),
            `${viewportConfig.name} ${check.path} apresentou erro de permissão`,
          );

          const screenshotFile = path.join(
            SMOKE_SCREENSHOT_DIR,
            `${viewportConfig.name}-${routePathToScreenshotName(check.path)}.png`,
          );
          await page.screenshot({ path: screenshotFile, fullPage: true });

          await page.close();
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    child.kill("SIGTERM");
    await delay(300);
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
