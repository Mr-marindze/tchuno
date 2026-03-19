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

const corsHeaders = {
  "access-control-allow-origin": WEB_URL,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "content-type": "application/json",
};

const now = new Date();
const inOneHour = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

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
];

const workerProfile = {
  id: "wp-1",
  userId: "worker-user-1",
  bio: "Especialista em serviços de eletricista residencial e comercial.",
  location: "Maputo, Polana",
  hourlyRate: 1200,
  experienceYears: 6,
  isAvailable: true,
  ratingAvg: "4.50",
  ratingCount: 8,
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

const quoteRequestedJob = {
  id: "job-quote-1",
  clientId: "client-1",
  workerProfileId: "wp-1",
  categoryId: "cat-eletricista",
  pricingMode: "QUOTE_REQUEST",
  title: "Diagnóstico de quadro elétrico",
  description: "Preciso de proposta para revisão do quadro.",
  budget: null,
  quotedAmount: 4500,
  quoteMessage: "Inclui deslocação e material.",
  status: "REQUESTED",
  acceptedAt: null,
  startedAt: null,
  scheduledFor: inOneHour,
  completedAt: null,
  canceledAt: null,
  canceledBy: null,
  cancelReason: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

const completedJob = {
  id: "job-completed-1",
  clientId: "client-1",
  workerProfileId: "wp-1",
  categoryId: "cat-eletricista",
  pricingMode: "FIXED_PRICE",
  title: "Troca de tomadas",
  description: "Substituição de tomadas antigas.",
  budget: 3200,
  quotedAmount: null,
  quoteMessage: null,
  status: "COMPLETED",
  acceptedAt: now.toISOString(),
  startedAt: now.toISOString(),
  scheduledFor: inOneHour,
  completedAt: now.toISOString(),
  canceledAt: null,
  canceledBy: null,
  cancelReason: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

const workerRequestedJob = {
  id: "job-worker-1",
  clientId: "client-2",
  workerProfileId: "wp-1",
  categoryId: "cat-eletricista",
  pricingMode: "FIXED_PRICE",
  title: "Instalação de disjuntor",
  description: "Preciso trocar disjuntor principal.",
  budget: 5000,
  quotedAmount: null,
  quoteMessage: null,
  status: "REQUESTED",
  acceptedAt: null,
  startedAt: null,
  scheduledFor: inOneHour,
  completedAt: null,
  canceledAt: null,
  canceledBy: null,
  cancelReason: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

const paginated = (data, page = 1, limit = 20) => ({
  data,
  meta: {
    total: data.length,
    page,
    limit,
    hasNext: false,
  },
});

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

function resolveMockBody(url) {
  if (url.pathname === "/auth/me") {
    return {
      user: {
        id: "smoke-admin-id",
        email: "admin@tchuno.local",
        name: "Smoke Admin",
        role: "ADMIN",
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

  if (url.pathname === "/worker-profile/me") {
    return workerProfile;
  }

  if (url.pathname === "/worker-profile") {
    const categorySlug = url.searchParams.get("categorySlug");
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

    const matchesCategory =
      !categorySlug ||
      workerProfile.categories.some((item) => item.slug === categorySlug);
    const matchesSearch =
      search.length === 0 ||
      [
        workerProfile.location,
        workerProfile.bio,
        ...workerProfile.categories.map((item) => item.name),
        workerProfile.userId,
      ]
        .filter((value) => Boolean(value))
        .join(" ")
        .toLowerCase()
        .includes(search);

    const data = matchesCategory && matchesSearch ? [workerProfile] : [];
    return paginated(data, 1, 20);
  }

  if (url.pathname.startsWith("/worker-profile/")) {
    return workerProfile;
  }

  if (url.pathname === "/jobs/me/client") {
    const status = url.searchParams.get("status");
    if (status === "COMPLETED") {
      return paginated([completedJob], 1, 100);
    }

    return paginated([quoteRequestedJob, completedJob], 1, 20);
  }

  if (url.pathname === "/jobs/me/worker") {
    return paginated([workerRequestedJob], 1, 20);
  }

  if (url.pathname === "/reviews/me") {
    return paginated([], 1, 20);
  }

  if (url.pathname.startsWith("/reviews/worker/")) {
    return paginated(
      [
        {
          id: "review-1",
          jobId: completedJob.id,
          workerProfileId: workerProfile.id,
          reviewerId: "client-1",
          rating: 5,
          comment: "Excelente.",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
      1,
      20,
    );
  }

  if (url.pathname === "/admin/ops/overview") {
    return {
      kpis: {
        totalJobs: 3,
        jobsByStatus: {
          REQUESTED: 2,
          ACCEPTED: 0,
          IN_PROGRESS: 0,
          COMPLETED: 1,
          CANCELED: 0,
        },
        completionRate: 33.3,
        totalReviews: 1,
        averageRating: 5,
        activePublicableWorkers: 1,
        jobsByPricingMode: {
          FIXED_PRICE: 2,
          QUOTE_REQUEST: 1,
        },
      },
      recentJobs: [quoteRequestedJob, workerRequestedJob, completedJob].map(
        (job) => ({
          id: job.id,
          title: job.title,
          status: job.status,
          pricingMode: job.pricingMode,
          clientId: job.clientId,
          workerProfileId: job.workerProfileId,
          budget: job.budget,
          quotedAmount: job.quotedAmount,
          cancelReason: job.cancelReason,
          hasReview: job.id === completedJob.id,
          createdAt: job.createdAt,
          acceptedAt: job.acceptedAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          canceledAt: job.canceledAt,
        }),
      ),
      recentlyCanceledJobs: [],
      completedWithoutReviewJobs: [],
    };
  }

  return {};
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

async function assertDashboardA11yBasics(page, check, viewportName) {
  const mainCount = await page.locator("main").count();
  assert(mainCount >= 1, `${viewportName} ${check.path} sem landmark <main>`);

  const h1Count = await page.getByRole("heading", { level: 1 }).count();
  assert(h1Count === 1, `${viewportName} ${check.path} deve ter um único <h1>`);

  const namedNavCount = await page.locator("[aria-label]").count();
  if (!check.allowNoAria) {
    assert(
      namedNavCount >= 1,
      `${viewportName} ${check.path} sem elemento com aria-label`,
    );
  }

  const hasButtonCta = await hasRoleWithName(page, "button", check.cta);
  const hasLinkCta = await hasRoleWithName(page, "link", check.cta);
  assert(
    hasButtonCta || hasLinkCta,
    `${viewportName} ${check.path} sem ação principal acessível por role`,
  );

  const unlabeledControls = await page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll("input, select, textarea"),
    );

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
      await page
        .getByText(requirement.value, { exact: false })
        .first()
        .waitFor({
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
          heading: "O que precisas hoje?",
          block: "Profissionais em destaque",
          cta: /Encontrar profissional|Entrar no Tchuno/,
          mustHave: [
            { type: "label", value: "Pesquisa principal" },
            { type: "aria", value: "Categorias" },
            { type: "text", value: "Profissionais em destaque" },
            { type: "text", value: "Encontra profissionais de confiança" },
          ],
        },
        {
          path: "/prestadores",
          heading: "Profissionais",
          block: "Pesquisa por serviço, área ou profissional",
          cta: /Procurar/,
          mustHave: [
            { type: "label", value: "Pesquisa" },
            { type: "label", value: "Área" },
            { type: "text", value: "No Tchuno, o valor final é negociado" },
          ],
        },
        {
          path: "/prestadores?categoria=inexistente",
          heading: "Profissionais",
          block: "Não encontrámos profissionais para este filtro",
          cta: /Limpar filtros/,
          mustHave: [{ type: "label", value: "Pesquisa" }],
        },
        {
          path: "/dashboard",
          heading: "Admin Ops",
          block: "Admin Ops Mínimo",
          cta: /Recarregar painel admin/,
        },
        {
          path: "/admin/orders",
          heading: "Gestão de pedidos",
          block: "Área protegida",
          cta: /Voltar ao painel admin/,
          allowNoAria: true,
        },
        {
          path: "/admin/providers",
          heading: "Descoberta de Profissionais",
          block: "Descoberta de Profissionais",
          cta: /Recarregar/,
        },
        {
          path: "/admin/users",
          heading: "Gestão de utilizadores",
          block: "Área protegida",
          cta: /Voltar ao painel admin/,
          allowNoAria: true,
        },
        {
          path: "/admin/reports",
          heading: "Admin Ops",
          block: "Admin Ops Mínimo",
          cta: /Recarregar painel admin/,
        },
        {
          path: "/admin/categories",
          heading: "Gestão de Categorias",
          block: "Gestão de categorias",
          cta: /Criar categoria/,
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
        const context = await browser.newContext({
          viewport: viewportConfig.viewport,
        });

        await context.addInitScript(() => {
          localStorage.setItem("tchuno_access_token", "smoke-access-token");
          localStorage.setItem("tchuno_refresh_token", "smoke-refresh-token");
          localStorage.setItem("tchuno_device_id", "smoke-device");
        });

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

            const body = resolveMockBody(url);
            await route.fulfill({
              status: 200,
              headers: corsHeaders,
              body: JSON.stringify(body),
            });
          },
        );

        for (const check of checks) {
          console.log(`Smoke ${viewportConfig.name}: ${check.path}`);
          const page = await context.newPage();
          await page.goto(`${WEB_URL}${check.path}`, {
            waitUntil: "networkidle",
          });

          await page
            .getByRole("heading", { level: 1, name: check.heading })
            .waitFor({
              timeout: 20_000,
            });
          await page.getByText(check.block, { exact: false }).first().waitFor({
            timeout: 20_000,
          });
          await page.getByText(check.cta).first().waitFor({
            timeout: 20_000,
          });

          await assertDashboardA11yBasics(page, check, viewportConfig.name);
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
        }

        await context.close();
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
