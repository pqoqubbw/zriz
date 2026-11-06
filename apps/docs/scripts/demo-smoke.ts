import process from "node:process";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";

import { chromium } from "playwright";
import type { Browser, Response } from "playwright";

import { DEMO_NAMES, DEMO_SPECS } from "../demos/registry.ts";
import type { DemoName } from "../demos/registry.ts";
import { PAGE_ORDER, pagePath } from "../lib/nav.ts";
import type { Slug } from "../lib/nav.ts";

type Width = { height: number; mobile: boolean; name: string; width: number };

type Sizes = {
  css: number;
  frame: number;
  html: number;
  initial: number;
  lazy: number;
};

type Visit = Sizes & {
  cls: number;
  console: string[];
  demo: DemoName | null;
  photoBytes: number;
  photoRequests: number;
  ready: number | null;
  status: number;
  violations: string[];
  zriz: boolean;
};

type Probe = { cls: number; violations: string[] };

type Row = { failures: string[]; slug: Slug; visit: Visit; width: Width };

const WIDTHS: readonly Width[] = [
  { height: 900, mobile: false, name: "560", width: 1280 },
  { height: 844, mobile: true, name: "390", width: 390 },
];

const KB = 1024;

const BUDGET = {
  cls: 0,
  css: 2 * KB,
  demoHtml: 2 * KB,
  demoInitial: 3 * KB,
  lazy: 60 * KB,
  photo: 220 * KB,
  ready: 1500,
};

const SETTLE = 600;

const READY_TIMEOUT = 15_000;

const ZRIZ_MARK = "data-zriz-item";

const PROBE = `
  window.__smoke = { cls: 0, violations: [] };
  document.addEventListener("securitypolicyviolation", (event) => {
    window.__smoke.violations.push(event.violatedDirective + " " + event.blockedURI);
  });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        window.__smoke.cls += entry.value;
      }
    }
  }).observe({ buffered: true, type: "layout-shift" });
`;

const { values } = parseArgs({
  options: {
    baseline: { type: "string" },
    dev: { default: false, type: "boolean" },
    url: { default: "http://localhost:4777", type: "string" },
  },
});

const isDemo = (name: string | null): name is DemoName =>
  DEMO_NAMES.some((demo) => demo === name);

const isProbe = (value: unknown): value is Probe =>
  typeof value === "object" &&
  value !== null &&
  typeof Reflect.get(value, "cls") === "number" &&
  Array.isArray(Reflect.get(value, "violations"));

const gzipOf = async (response: Response): Promise<number> => {
  try {
    return gzipSync(await response.body()).length;
  } catch {
    return 0;
  }
};

const visit = async (
  browser: Browser,
  base: string,
  slug: Slug,
  width: Width
): Promise<Visit> => {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    hasTouch: width.mobile,
    isMobile: width.mobile,
    viewport: { height: width.height, width: width.width },
  });
  const page = await context.newPage();
  const messages: string[] = [];
  const pending: Promise<void>[] = [];
  const sizes: Sizes = { css: 0, frame: 0, html: 0, initial: 0, lazy: 0 };
  const assets = new Map<string, Response>();
  let html = "";
  let photoBytes = 0;
  let photoRequests = 0;
  let zriz = false;

  await page.addInitScript(PROBE);

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(`${message.type()}: ${message.text().slice(0, 160)}`);
    }
  });

  page.on("pageerror", (error) => {
    messages.push(`pageerror: ${error.message.slice(0, 160)}`);
  });

  page.on("response", (response) => {
    if (response.url().startsWith("blob:")) {
      return;
    }

    const type = response.request().resourceType();
    const { pathname } = new URL(response.url());

    if (pathname.startsWith("/demo/")) {
      photoRequests += 1;
    }

    pending.push(
      (async () => {
        if (pathname.startsWith("/demo/")) {
          const body = await response.body().catch(() => Buffer.alloc(0));

          photoBytes += body.length;

          return;
        }

        if (type === "script") {
          const text = await response.text().catch(() => "");

          assets.set(pathname, response);
          zriz ||= text.includes(ZRIZ_MARK);
        } else if (type === "stylesheet") {
          assets.set(pathname, response);
        } else if (type === "document") {
          html = await response.text().catch(() => "");
          sizes.html += await gzipOf(response);
        }
      })()
    );
  });

  const response = await page.goto(`${base}${pagePath(slug)}`, {
    waitUntil: "load",
  });

  const loadedAt = await page.evaluate(() => performance.now());
  const name = await page
    .locator("[data-demo]")
    .first()
    .getAttribute("data-demo", { timeout: 1000 })
    .catch(() => null);
  const demo = isDemo(name) ? name : null;
  let ready: number | null = null;

  if (demo) {
    const start = DEMO_SPECS[demo].below
      ? await page.evaluate(() => {
          document.querySelector("[data-demo]")?.scrollIntoView({
            block: "center",
          });

          return performance.now();
        })
      : loadedAt;
    const done = await page
      .waitForFunction(
        () =>
          document.querySelector('[data-zriz-item="image"][data-ready]') ===
          null
            ? false
            : performance.now(),
        undefined,
        { timeout: READY_TIMEOUT }
      )
      .then(async (handle) => Number(await handle.jsonValue()))
      .catch(() => null);

    ready = done === null ? null : Math.max(0, done - start);
  }

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(SETTLE);
  await Promise.all(pending);

  const counted = await Promise.all(
    [...assets].map(async ([pathname, asset]) => ({
      bytes: await gzipOf(asset),
      initial: html.includes(pathname),
      style: asset.request().resourceType() === "stylesheet",
    }))
  );

  for (const asset of counted) {
    if (asset.style && asset.initial) {
      sizes.css += asset.bytes;
    } else {
      sizes[asset.initial ? "initial" : "lazy"] += asset.bytes;
    }
  }

  const frame = await page.evaluate(
    (source) =>
      new DOMParser()
        .parseFromString(source, "text/html")
        .querySelector("[data-demo]")?.outerHTML ?? "",
    html
  );

  sizes.frame = frame === "" ? 0 : gzipSync(frame).length;

  const found = await page.evaluate((): unknown =>
    Reflect.get(globalThis, "__smoke")
  );
  const probe = isProbe(found) ? found : { cls: Number.NaN, violations: [] };

  await context.close();

  return {
    ...sizes,
    cls: probe.cls,
    console: messages,
    demo,
    photoBytes,
    photoRequests,
    ready,
    status: response?.status() ?? 0,
    violations: probe.violations,
    zriz,
  };
};

const judgePage = (current: Visit): string[] => [
  ...(current.status === 200 ? [] : [`status ${current.status}`]),
  ...(current.violations.length > 0
    ? [`csp: ${current.violations.join(", ")}`]
    : []),
  ...current.console,
  ...(current.cls > BUDGET.cls ? [`cls ${current.cls.toFixed(4)}`] : []),
];

const judgePlain = (current: Visit, before: Visit | undefined): string[] => [
  ...(current.zriz ? ["zriz code on a page with no demo"] : []),
  ...(current.photoRequests > 0 ? ["photo on a page with no demo"] : []),
  ...(!values.dev && before && current.initial > before.initial
    ? [`js +${current.initial - before.initial} B`]
    : []),
];

const judgeDemo = (current: Visit): string[] => [
  ...(current.ready === null ? ["demo never painted its photo"] : []),
  ...(!values.dev && current.ready !== null && current.ready > BUDGET.ready
    ? [`ready ${Math.round(current.ready)} ms`]
    : []),
  ...(current.photoRequests === 1
    ? []
    : [`${current.photoRequests} photo requests`]),
  ...(current.photoBytes > BUDGET.photo
    ? [`photo ${current.photoBytes} B`]
    : []),
];

const judgeWeight = (current: Visit, before: Visit | undefined): string[] => {
  if (values.dev) {
    return [];
  }

  const failures = [
    ...(current.lazy > BUDGET.lazy ? [`lazy ${current.lazy} B`] : []),
    ...(current.frame > BUDGET.demoHtml
      ? [`frame html ${current.frame} B`]
      : []),
  ];

  if (!before) {
    return failures;
  }

  const growth: [string, number, number][] = [
    ["js", current.initial - before.initial, BUDGET.demoInitial],
    ["css", current.css - before.css, BUDGET.css],
  ];

  return [
    ...failures,
    ...growth
      .filter(([, grown, limit]) => grown > limit)
      .map(([what, grown]) => `${what} +${grown} B`),
  ];
};

const judge = (current: Visit, before: Visit | undefined): string[] => [
  ...judgePage(current),
  ...(current.demo
    ? [...judgeDemo(current), ...judgeWeight(current, before)]
    : judgePlain(current, before)),
];

const kb = (bytes: number): string => (bytes / KB).toFixed(1);

const delta = (now: number, then: number | undefined): string =>
  then === undefined
    ? kb(now)
    : `${kb(now)} (${now >= then ? "+" : ""}${kb(now - then)})`;

const line = (row: Row, before: Visit | undefined): string =>
  [
    row.slug,
    row.width.name,
    String(row.visit.status),
    row.visit.demo ?? "",
    delta(row.visit.initial, before?.initial),
    kb(row.visit.lazy),
    delta(row.visit.html, before?.html),
    row.visit.demo ? kb(row.visit.frame) : "",
    delta(row.visit.css, before?.css),
    row.visit.photoRequests > 0
      ? `${row.visit.photoRequests}x ${kb(row.visit.photoBytes)}`
      : "",
    row.visit.ready === null ? "" : String(Math.round(row.visit.ready)),
    row.visit.cls.toFixed(3),
    row.failures.length === 0 ? "ok" : row.failures.join("; "),
  ].join(" | ");

const HEAD =
  "page | width | status | demo | js kB gzip | lazy js+css kB | page html kB | frame html kB | css kB | photo | ready ms | cls | result";

const run = async (
  browser: Browser,
  base: string,
  jobs: readonly [Slug, Width][],
  results = new Map<string, Visit>()
): Promise<Map<string, Visit>> => {
  const [job, ...rest] = jobs;

  if (!job) {
    return results;
  }

  const [slug, width] = job;

  results.set(`${slug}@${width.name}`, await visit(browser, base, slug, width));

  return await run(browser, base, rest, results);
};

const JOBS: readonly [Slug, Width][] = PAGE_ORDER.flatMap((slug) =>
  WIDTHS.map((width): [Slug, Width] => [slug, width])
);

const browser = await chromium.launch();

try {
  const baseline =
    values.baseline === undefined
      ? new Map<string, Visit>()
      : await run(browser, values.baseline, JOBS);
  const current = await run(browser, values.url, JOBS);
  const rows = JOBS.map(([slug, width]): Row => {
    const key = `${slug}@${width.name}`;
    const found = current.get(key);

    if (!found) {
      throw new Error(`no visit for ${key}`);
    }

    return {
      failures: judge(found, baseline.get(key)),
      slug,
      visit: found,
      width,
    };
  });

  process.stdout.write(`${HEAD}\n`);

  for (const row of rows) {
    process.stdout.write(
      `${line(row, baseline.get(`${row.slug}@${row.width.name}`))}\n`
    );
  }

  const failed = rows.filter((row) => row.failures.length > 0).length;

  process.stdout.write(
    `\n${PAGE_ORDER.length} pages, ${rows.length} visits, ${failed} failed\n`
  );

  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  await browser.close();
}
