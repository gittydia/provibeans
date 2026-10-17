import "./env.mjs";

/**
 * Layout geometry for the inventory application.
 *
 * Static checks cannot tell whether a table header sits over its own column, whether two
 * cards in a row share a height, or whether a badge floats to the top of a row
 * while the numbers beside it sit in the middle. This suite drives a real
 * browser and measures those things, because a screenshot cannot be asserted on.
 *
 * It signs in through the actual demo form and needs no external data access.
 *
 * It prints SKIPPED and exits 0 when no browser is available, so `verify:all`
 * stays meaningful on a machine without one.
 */

const base = process.env.SMOKE_BASE ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@provibeans.ph";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "ProviBeans2026";

const results = [];
const record = (label, ok, detail = "") => results.push({ label, ok, detail });

/* The content limiter DESIGN.md §4 specifies: `min(1500px, 100% - gutters)`.
   Nothing implemented it, which is why the audit found panels stretched to
   1848px on a 1920px display. Asserted here so it cannot silently regress. */
const CONTENT_LIMITER = 1500;

/* Sub-pixel rasterisation is allowed to differ by a hair between two edges that
   are nominally identical. */
const EPSILON = 1.5;

/* app/app.css switches the sidebar between a docked rail and an off-canvas
   drawer here, and the touch-target rules follow the same breakpoint. */
const MOBILE_BREAKPOINT = 860;

/* DESIGN.md §8 sets 44px as the floor for a touch target. */
const TOUCH_TARGET = 44;

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 425, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const ROUTES = [
  "/dashboard",
  "/batches",
  "/batches/receive",
  "/batches/quarantine",
  "/issue",
  "/issue/movements",
  "/catalog",
  "/catalog/suppliers",
  "/catalog/deliveries",
  "/reports",
  "/reports/movements",
  "/reports/activity",
  "/reports/periods",
];

/* Columns that deliberately opt out of the shared cell gutter: the thumbnail is
   inset so the pouch reads as an object rather than as a text column. */
const GUTTER_EXEMPT = ".thumb";

async function launchBrowser() {
  const { chromium } = await import("playwright-core");
  const attempts = [
    { label: "msedge", options: { channel: "msedge" } },
    {
      label: "edge (default install path)",
      options: { executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" },
    },
    { label: "chrome", options: { channel: "chrome" } },
  ];

  for (const attempt of attempts) {
    if (attempt.options.executablePath) {
      const { existsSync } = await import("node:fs");
      if (!existsSync(attempt.options.executablePath)) continue;
    }
    try {
      return await chromium.launch({ headless: true, ...attempt.options });
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ in-page
   One evaluate per route returns the raw geometry; every threshold decision is
   made in Node so the assertions stay readable and the failure detail is a
   plain sentence rather than a boolean buried in the page. */
function collect() {
  /* Serialised into the page, so nothing here may close over a module constant. */
  const TOLERANCE = 1.5;
  const seen = (el) => el.offsetParent !== null || el.getClientRects().length > 0;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  const pad = (el) => {
    const s = getComputedStyle(el);
    return {
      left: Math.round(parseFloat(s.paddingLeft) || 0),
      right: Math.round(parseFloat(s.paddingRight) || 0),
      top: Math.round(parseFloat(s.paddingTop) || 0),
      verticalAlign: s.verticalAlign,
      textAlign: s.textAlign,
    };
  };

  const main = document.querySelector("main.main");
  const mainBox = main ? box(main) : null;
  const mainStyle = main ? getComputedStyle(main) : null;

  /* The sidebar owns its own scrollport, so its height is the viewport height
     rather than however tall the main column happens to be. Measuring it here
     is what lets the suite tell "sticky and fixed to the viewport" apart from
     "stretched to the grid row and scrolling away with the body".

     The scroller is looked up as `.side-scroll` first and falls back to `.side`
     itself, so the assertion survives either shape of the shell: the rail
     itself scrolling, or a non-clipping rail wrapping an inner scroller. */
  const sideRail = document.querySelector(".side");
  const sideEl = document.querySelector(".side-scroll") ?? sideRail;
  const sideStyle = sideEl ? getComputedStyle(sideEl) : null;

  /* The collapse control is icon-only, so its box, its glyph and its two
     labels are the only things describing it. All four are measured here. */
  const toggle = document.querySelector(".sidebar-toggle");

  const tables = [...document.querySelectorAll("table")].filter(seen).map((table) => {
    const headRow = table.tHead?.rows?.[0] ?? null;
    const headCells = headRow ? [...headRow.cells] : [];
    const bodyRows = [...(table.tBodies?.[0]?.rows ?? [])].filter(seen);
    const firstRowCells = bodyRows[0] ? [...bodyRows[0].cells] : [];

    /* A table is allowed to be wider than its box only when something between
       it and the viewport can scroll. Anything else is a leak. */
    const scrollHost = (() => {
      let node = table.parentElement;
      while (node) {
        const flow = getComputedStyle(node).overflowX;
        if (["auto", "scroll", "hidden", "clip"].includes(flow)) return flow;
        node = node.parentElement;
      }
      return null;
    })();

    const alignDeltas = [];
    for (let i = 0; i < Math.min(headCells.length, firstRowCells.length); i += 1) {
      const th = headCells[i];
      const td = firstRowCells[i];
      if (!seen(th) && !seen(td)) continue;
      alignDeltas.push({
        column: i,
        delta: Math.round((box(td).left - box(th).left) * 100) / 100,
        exempt: th.classList.contains("thumb-col") || td.classList.contains("thumb"),
      });
    }

    /* Below the stacking breakpoint a row is a labelled block rather than a grid
       of columns, so "does the header sit over its column" and "do cells share a
       gutter" have no meaning: there is no column to sit over. `display: block`
       on the table itself is the signal, read from the cascade rather than from
       the viewport, so the two can never disagree. */
    const stacked = getComputedStyle(table).display === "block";

    /* Every cell needs its column name once the grid dissolves, or a stacked
       value is an unlabelled number. */
    const unlabelled = stacked
      ? bodyRows.flatMap((row) =>
          [...row.cells]
            .filter((cell) => seen(cell) && !(cell.dataset.label ?? "").trim())
            .map((cell) => (cell.textContent ?? "").trim().slice(0, 18)),
        )
      : [];

    return {
      caption: (table.closest(".panel, section")?.querySelector("h2")?.textContent ?? "").trim(),
      stacked,
      unlabelled,
      headCount: headCells.length,
      rowCounts: bodyRows.map((row) => row.cells.length),
      alignDeltas,
      headPad: headCells.filter(seen).map((cell) => pad(cell)),
      bodyPad: bodyRows.flatMap((row) => [...row.cells].filter(seen).map(pad)),
      /* The thumbnail is exempt from the shared vertical rhythm on purpose: it
         takes no vertical padding and is centred by `vertical-align: middle`,
         so padding it would only add dead height to every product row. */
      headTopPad: headCells.filter((cell) => seen(cell) && !cell.classList.contains("thumb")).map((cell) => pad(cell).top),
      bodyTopPad: bodyRows.flatMap((row) =>
        [...row.cells]
          .filter((cell) => seen(cell) && !cell.classList.contains("thumb"))
          .map((cell) => pad(cell).top),
      ),
      bodyAligns: [
        ...new Set(bodyRows.flatMap((row) => [...row.cells].filter(seen).map((c) => pad(c).verticalAlign))),
      ].sort(),
      numericTextAligns: [
        ...new Set(
          bodyRows
            .flatMap((row) => [...row.cells])
            .filter((cell) => cell.classList.contains("num") && seen(cell))
            .map((cell) => pad(cell).textAlign),
        ),
      ],
      leakedTable:
        scrollHost === null && box(table).right > document.documentElement.clientWidth + TOLERANCE,
    };
  });

  const statGrid = document.querySelector(".stat-grid");
  const stats = statGrid
    ? [...statGrid.children].filter(seen).map((child) => ({ ...box(child), gaps: pad(child) }))
    : [];

  const badgeRows = [];
  for (const row of document.querySelectorAll("tbody tr")) {
    if (!seen(row)) continue;
    const rowBox = box(row);
    const offsets = [];
    for (const cell of row.cells) {
      const badge = [...cell.children].find((child) => child.classList.contains("badge"));
      if (!badge) continue;
      const cellBox = box(cell);
      const badgeBox = box(badge);
      offsets.push(
        Math.round(((badgeBox.top + badgeBox.bottom) / 2 - (cellBox.top + cellBox.bottom) / 2) * 100) / 100,
      );
    }
    if (offsets.length > 0) badgeRows.push({ height: Math.round(rowBox.height * 100) / 100, offsets });
  }

  /* Controls grouped into rows by their field's top edge. A field is a grid item
     that stretches to its tallest neighbour, so without `align-content: start`
     its own rows absorb the slack and the controls drift apart. */
  const fieldRows = [...document.querySelectorAll(".form-grid")]
    .filter(seen)
    .map((grid) => {
      const caption =
        grid.closest(".panel, section")?.querySelector("h2")?.textContent?.trim() ??
        "(unlabelled)";
      const rows = new Map();
      for (const field of grid.querySelectorAll(".field")) {
        const control = field.querySelector("input, select, textarea");
        if (!control || !seen(control)) continue;
        const top = Math.round(box(field).top);
        if (!rows.has(top)) rows.set(top, []);
        rows.get(top).push({
          controlTop: Math.round(box(control).top * 100) / 100,
          controlHeight: Math.round(box(control).height * 100) / 100,
        });
      }
      return {
        caption,
        rows: [...rows.values()].filter((row) => row.length > 1),
      };
    })
    .filter((grid) => grid.rows.length > 0);

  const panels = [...document.querySelectorAll(".panel")].filter(seen).map((panel) => {
    const panelBox = box(panel);
    const table = panel.querySelector(":scope > table");
    return {
      caption: (panel.querySelector(":scope > header h2")?.textContent ?? "").trim(),
      top: Math.round(panelBox.top * 100) / 100,
      panelRight: Math.round(panelBox.right * 100) / 100,
      tableRight: table ? Math.round(box(table).right * 100) / 100 : null,
      overflowX: getComputedStyle(panel).overflowX,
      overflowsViewport: panelBox.right > document.documentElement.clientWidth + TOLERANCE,
    };
  });

  /* Panels that share a .split row are read as one band, so their top edges must
     agree. Stacked children (narrow viewports) legitimately do not, so the
     comparison only applies to children whose vertical ranges actually meet. */
  const splitRows = [...document.querySelectorAll(".split")]
    .filter(seen)
    .map((split) =>
      [...split.children].filter(seen).map((child) => {
        const b = box(child);
        return { top: Math.round(b.top * 100) / 100, bottom: Math.round(b.bottom * 100) / 100, height: Math.round(b.height * 100) / 100 };
      }),
    )
    .filter((children) => children.length > 1);

  return {
    route: location.pathname,
    viewport: window.innerWidth,
    doc: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    },
    main: mainBox
      ? {
          left: mainBox.left,
          right: mainBox.right,
          width: mainBox.width,
          paddingLeft: Math.round(parseFloat(mainStyle.paddingLeft) || 0),
          paddingRight: Math.round(parseFloat(mainStyle.paddingRight) || 0),
          contentWidth: Math.round(
            (mainBox.width - (parseFloat(mainStyle.paddingLeft) || 0) - (parseFloat(mainStyle.paddingRight) || 0)) * 100,
          ) / 100,
        }
      : null,
    /* Gated on the rail, never the scroller: the rail is always rendered (the
       mobile drawer is translated off-canvas rather than removed), whereas the
       inner scroller is display:none whenever the sidebar is collapsed, which
       would make the measurement vanish at narrow widths. */
  side:
      sideRail && seen(sideRail)
        ? {
            top: Math.round(box(sideRail).top * 100) / 100,
            height: Math.round(box(sideRail).height * 100) / 100,
            position: getComputedStyle(sideRail).position,
            overflowY: sideStyle ? sideStyle.overflowY : getComputedStyle(sideRail).overflowY,
            overscrollY: sideStyle
              ? sideStyle.overscrollBehaviorY
              : getComputedStyle(sideRail).overscrollBehaviorY,
            viewportHeight: window.innerHeight,
            /* Whether the nav actually outruns the sidebar's own box, which is
               the case the ticket's internal-scrolling clause exists for. */
            overflowsSelf: sideEl ? sideEl.scrollHeight > sideEl.clientHeight + 1 : false,
          }
        : null,
    toggle:
      toggle && seen(toggle)
        ? {
            text: (toggle.textContent ?? "").trim(),
            hasSvg: Boolean(toggle.querySelector("svg")),
            tooltip: toggle.getAttribute("data-tooltip") ?? "",
            ariaLabel: toggle.getAttribute("aria-label") ?? "",
            width: Math.round(box(toggle).width * 100) / 100,
            height: Math.round(box(toggle).height * 100) / 100,
          }
        : null,
    tables,
    stats,
    badgeRows,
    panels,
    splitRows,
    fieldRows,
  };
}

function worst(list, pick) {
  return list.reduce((acc, item) => Math.max(acc, Math.abs(pick(item))), 0);
}

async function main() {
  const browser = await launchBrowser();
  if (!browser) {
    console.log("SKIPPED — no browser could be launched (looked for Edge and Chrome).");
    console.log("Layout geometry is unverified; every other suite still ran.");
    process.exit(0);
  }

  const context = await browser.newContext();

  /* Sign in the way a person does: fill the form and submit it. Inserting a
     session row directly would mean this suite writes to a table, and a layout
     check has no business doing that. */
  const signIn = await context.newPage();
  await signIn.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  /* `domcontentloaded` fires before React hydrates. Submitting in that window
     bypasses the form's own onSubmit, the browser does a plain GET to /login,
     and the wait below times out on a suite that is actually fine. Wait for the
     handler to exist before touching anything. */
  await signIn.waitForFunction(
    () => {
      const form = document.querySelector("form");
      return Boolean(form) && Object.keys(form).some((key) => key.startsWith("__react"));
    },
    null,
    { timeout: 30_000 },
  );
  await signIn.fill('input[name="email"]', EMAIL);
  await signIn.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    signIn.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    signIn.click('button[type="submit"]'),
  ]);
  await signIn.close();

  const perViewport = new Map();
  const perRoute = new Map();
  const fetches = [];

  /* One page per route, measured concurrently.

     The page is fetched ONCE per route and then resized through the viewport
     matrix. Resizing re-runs media queries and reflows, but it does not re-request
     the document — and every screen here is server-rendered from a remote Neon
     database, at 0.4s to 5.4s a render. Re-navigating per viewport meant 49
     server renders; this is 7. The geometry is identical, because everything
     that changes with width lives in CSS, not in the markup. */
  const measure = async (page) => {
    const collected = [];
    await page.setViewportSize(VIEWPORTS[0]);
    const response = await page.goto(`${base}${page.__route}`, { waitUntil: "domcontentloaded" });
    if (!response || response.status() !== 200) {
      for (const viewport of VIEWPORTS) {
        record(`${page.__route} renders at ${viewport.width}px`, false, `status=${response?.status()}`);
      }
      return collected;
    }
    await page.waitForSelector("main.main");

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const measured = await page.evaluate(collect);
      collected.push(measured);
      if (!perViewport.has(viewport.width)) perViewport.set(viewport.width, []);
      perViewport.get(viewport.width).push(measured);
      if (!perRoute.has(page.__route)) perRoute.set(page.__route, []);
      perRoute.get(page.__route).push(measured);
    }
    return collected;
  };

  const pages = await Promise.all(
    ROUTES.map(async (route) => {
      const page = await context.newPage();
      page.__route = route;
      return measure(page);
    }),
  );

  for (const page of pages) fetches.push(...page);

  // ---------------------------------------------------------- page overflow
  for (const [width, measurements] of perViewport) {
    const offenders = measurements
      .filter((m) => m.doc.scrollWidth > m.doc.clientWidth + EPSILON)
      .map((m) => `${m.route} scrollWidth=${m.doc.scrollWidth} client=${m.doc.clientWidth}`);
    record(
      `${width}px: no screen scrolls the page sideways`,
      offenders.length === 0,
      offenders.join(" | "),
    );
  }

  // ---------------------------------------------------------- the container
  for (const [width, measurements] of perViewport) {
    const asymmetric = measurements
      .filter((m) => m.main && Math.abs(m.main.paddingLeft - m.main.paddingRight) > EPSILON)
      .map((m) => `${m.route} ${m.main.paddingLeft}px left vs ${m.main.paddingRight}px right`);
    record(
      `${width}px: the page container has symmetric gutters`,
      asymmetric.length === 0,
      asymmetric.join(" | "),
    );
  }

  const overLimit = fetches
    .filter((m) => m.main && m.main.contentWidth > CONTENT_LIMITER + EPSILON)
    .map((m) => `${m.route}@${m.viewport}px content=${m.main.contentWidth}px`);
  record(
    `no screen exceeds the ${CONTENT_LIMITER}px content limiter from DESIGN.md`,
    overLimit.length === 0,
    overLimit.join(" | "),
  );

  // ---------------------------------------------------------- table columns
  for (const [route, measurements] of perRoute) {
    const misaligned = [];
    for (const m of measurements) {
      for (const table of m.tables) {
        if (table.stacked) continue;
        for (const delta of table.alignDeltas) {
          if (delta.exempt) continue;
          if (Math.abs(delta.delta) > EPSILON) {
            misaligned.push(`${m.viewport}px ${table.caption || "table"} column ${delta.column} off by ${delta.delta}px`);
          }
        }
      }
    }
    record(`${route}: every table header sits over its own column`, misaligned.length === 0, misaligned.join(" | "));
  }

  /* The stacked counterpart of the two grid checks: once a row is a list of
     labelled pairs, an unlabelled cell is the same defect a misaligned header
     would be in the grid. */
  for (const [route, measurements] of perRoute) {
    const stranded = [];
    for (const m of measurements) {
      for (const table of m.tables) {
        for (const value of table.unlabelled) {
          stranded.push(`${m.viewport}px ${table.caption || "table"} cell "${value}" has no column label`);
        }
      }
    }
    record(`${route}: every stacked cell carries its column label`, stranded.length === 0, stranded.join(" | "));
  }

  for (const [route, measurements] of perRoute) {
    const ragged = [];
    for (const m of measurements) {
      for (const table of m.tables) {
        const bad = table.rowCounts.filter((count) => count !== table.headCount);
        if (bad.length > 0) {
          ragged.push(`${m.viewport}px ${table.caption || "table"} has ${table.headCount} headers but rows of ${[...new Set(bad)].join("/")}`);
        }
      }
    }
    record(`${route}: every row carries the header's column count`, ragged.length === 0, ragged.join(" | "));
  }

  for (const [route, measurements] of perRoute) {
    const inconsistent = [];
    for (const m of measurements) {
      for (const table of m.tables) {
        if (table.stacked) continue;
        const gutters = new Set([
          ...table.headPad.map((p) => p.left),
          ...table.bodyPad.map((p) => p.left),
        ]);
        const rightGutters = new Set([
          ...table.headPad.map((p) => p.right),
          ...table.bodyPad.map((p) => p.right),
        ]);
        if (gutters.size > 1 || rightGutters.size > 1) {
          inconsistent.push(
            `${m.viewport}px ${table.caption || "table"} left=[${[...gutters].join(",")}] right=[${[...rightGutters].join(",")}]`,
          );
        }

        /* A header row 1px shorter than the body rows it labels reads as a
           separate rhythm, so the vertical padding has to match too. */
        const headTop = new Set(table.headTopPad);
        const bodyTop = new Set(table.bodyTopPad);
        const onlyHead = [...headTop].filter((value) => !bodyTop.has(value));
        const onlyBody = [...bodyTop].filter((value) => !headTop.has(value));
        if (onlyHead.length > 0 || onlyBody.length > 0) {
          inconsistent.push(
            `${m.viewport}px ${table.caption || "table"} header pads ${[...headTop].join(",")} but cells pad ${[...bodyTop].join(",")}`,
          );
        }
      }
    }
    record(
      `${route}: table cells share one gutter, headers included`,
      inconsistent.length === 0,
      inconsistent.join(" | "),
    );
  }

  // ---------------------------------------------------------- cell alignment
  const mixedAlign = [];
  for (const m of fetches) {
    for (const table of m.tables) {
      const unaligned = table.bodyAligns.filter((align) => align !== "middle" && align !== "top");
      if (unaligned.length > 0) {
        mixedAlign.push(`${m.route}@${m.viewport}px ${table.caption || "table"} [${unaligned.join(",")}]`);
      }
    }
  }
  record(
    "table cells resolve to a declared vertical alignment (top or middle)",
    mixedAlign.length === 0,
    mixedAlign.join(" | "),
  );

  const strayNumerics = [];
  for (const m of fetches) {
    for (const table of m.tables) {
      const wrong = table.numericTextAligns.filter((align) => align !== "right");
      if (wrong.length > 0) {
        strayNumerics.push(`${m.route}@${m.viewport}px ${table.caption || "table"} [${wrong.join(",")}]`);
      }
    }
  }
  record("numeric cells are right-aligned in every table", strayNumerics.length === 0, strayNumerics.join(" | "));

  const badgeDrift = fetches.flatMap((m) =>
    m.badgeRows
      .filter((row) => worst(row.offsets, (offset) => offset) > 2)
      .map(
        (row) =>
          `${m.route}@${m.viewport}px badge sits ${worst(row.offsets, (o) => o).toFixed(1)}px off the row's vertical centre (row ${row.height}px)`,
      ),
  );
  record(
    "status badges share the vertical centre of their row",
    badgeDrift.length === 0,
    badgeDrift.slice(0, 4).join(" | "),
  );

  // ---------------------------------------------------------- cards and grids
  const cardIssues = [];
  for (const m of fetches) {
    if (m.stats.length === 0) continue;
    const rows = new Map();
    for (const stat of m.stats) {
      const key = Math.round(stat.top);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(stat);
    }
    for (const [, row] of rows) {
      const heights = row.map((card) => Math.round(card.height));
      if (new Set(heights).size > 1) cardIssues.push(`${m.route}@${m.viewport}px row heights ${heights.join("/")}`);
      const gaps = [];
      for (let i = 1; i < row.length; i += 1) gaps.push(Math.round(row[i].left - row[i - 1].right));
      if (new Set(gaps).size > 1) {
        cardIssues.push(`${m.route}@${m.viewport}px uneven card gaps ${gaps.join("/")}`);
      }
    }
  }
  record(
    "statistic cards in a row share a height and an even gap",
    cardIssues.length === 0,
    cardIssues.slice(0, 4).join(" | "),
  );

  const panelBleed = fetches.flatMap((m) =>
    m.panels
      .filter((panel) => panel.overflowsViewport)
      .map((panel) => `${m.route}@${m.viewport}px ${panel.caption || "panel"} right=${panel.panelRight}`),
  );
  record("no panel escapes the viewport", panelBleed.length === 0, panelBleed.slice(0, 4).join(" | "));

  const tableBleed = fetches.flatMap((m) =>
    m.panels
      .filter((panel) => panel.tableRight !== null && panel.tableRight > panel.panelRight + EPSILON)
      .filter((panel) => !["auto", "scroll", "hidden", "clip"].includes(panel.overflowX))
      .map(
        (panel) =>
          `${m.route}@${m.viewport}px ${panel.caption || "panel"} table ${panel.tableRight} > panel ${panel.panelRight} and overflow-x=${panel.overflowX}`,
      ),
  );
  record(
    "a wide table is contained by a scrolling panel instead of leaking",
    tableBleed.length === 0,
    tableBleed.slice(0, 4).join(" | "),
  );

  const unclipped = fetches.flatMap((m) =>
    m.tables
      .filter((table) => table.leakedTable)
      .map((table) => `${m.route}@${m.viewport}px ${table.caption || "table"} is not inside a scrolling panel`),
  );
  record(
    "no data table overflows without a scroll container",
    unclipped.length === 0,
    unclipped.slice(0, 4).join(" | "),
  );

  // --------------------------------------------------- sidebar scroll ownership
  /* The sidebar is supposed to be pinned to the viewport and to scroll on its
     own. Left to the grid, it stretches to the tallest column instead and
     scrolls away with the body — which is what these numbers catch. */
  const allMeasures = [...perViewport.values()].flat();
  const measuredSides = allMeasures.filter((m) => m.side);

  record(
    "every screen has a measurable sidebar",
    measuredSides.length === allMeasures.length,
    `measured ${measuredSides.length}/${allMeasures.length}`,
  );

  /* Height, not top: at scroll 0 a sticky element sits at the top either way,
     so its top proves nothing. Its height does — pinned to the viewport it can
     never exceed 100dvh, whereas a grid-stretched sidebar is as tall as the
     main column plus whatever overflows it. */
  const overTall = measuredSides
    .filter((m) => m.side.height > m.side.viewportHeight + EPSILON)
    .map((m) => `${m.route}@${m.viewport}px side=${m.side.height}px viewport=${m.side.viewportHeight}px`);
  record(
    "the sidebar is never taller than the viewport",
    overTall.length === 0,
    overTall.slice(0, 4).join(" | "),
  );

  const shortOfViewport = measuredSides
    .filter((m) => m.side.height < m.side.viewportHeight - EPSILON)
    .map((m) => `${m.route}@${m.viewport}px side=${m.side.height}px viewport=${m.side.viewportHeight}px`);
  record(
    "the sidebar fills the viewport height rather than shrinking into it",
    shortOfViewport.length === 0,
    shortOfViewport.slice(0, 4).join(" | "),
  );

  /* The property that stops a wheel gesture running out of the sidebar and
     dragging the page behind it. Asserted at every viewport because the mobile
     drawer is a separate declaration from the desktop rail. */
  const chains = measuredSides
    .filter((m) => m.side.overscrollY !== "contain")
    .map((m) => `${m.route}@${m.viewport}px overscroll-behavior-y=${m.side.overscrollY}`);
  record(
    "the sidebar contains its own scroll gestures",
    chains.length === 0,
    chains.slice(0, 4).join(" | "),
  );

  const notAScroller = measuredSides
    .filter((m) => !["auto", "scroll"].includes(m.side.overflowY))
    .map((m) => `${m.route}@${m.viewport}px overflow-y=${m.side.overflowY}`);
  record(
    "the sidebar is its own scroll container",
    notAScroller.length === 0,
    notAScroller.slice(0, 4).join(" | "),
  );

  /* Computed styles only prove the declaration was written. This proves the
     behaviour: scroll the page and the sidebar must stay put, and wheel over
     the sidebar must not drag the document. Runs once, on one screen at one
     width, because both are properties of the shell rather than of a route. */
  const probe = await context.newPage();
  await probe.setViewportSize({ width: 1440, height: 900 });
  await probe.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  await probe.waitForSelector(".side");

  const sideAt = () =>
    probe.evaluate(() => {
      const side = document.querySelector(".side");
      return {
        scrollY: window.scrollY,
        sideTop: Math.round(side.getBoundingClientRect().top * 100) / 100,
        docScrollable: document.documentElement.scrollHeight > window.innerHeight + 1,
      };
    });

  const atRest = await sideAt();
  record(
    "the main column is what scrolls, not the page shell",
    atRest.docScrollable,
    atRest.docScrollable ? "" : "the document does not overflow, so this check cannot fail",
  );

  await probe.evaluate(() => window.scrollTo(0, 400));
  await probe.waitForTimeout(150);
  const afterScroll = await sideAt();
  record(
    "the sidebar stays pinned while the main column scrolls",
    afterScroll.scrollY > 0 && Math.abs(afterScroll.sideTop) <= EPSILON,
    `scrollY=${afterScroll.scrollY} sideTop=${afterScroll.sideTop}`,
  );

  await probe.evaluate(() => window.scrollTo(0, 0));
  await probe.waitForTimeout(100);
  const sideBox = await probe.locator(".side").boundingBox();
  await probe.mouse.move(sideBox.x + sideBox.width / 2, sideBox.y + sideBox.height / 2);
  await probe.mouse.wheel(0, 600);
  await probe.waitForTimeout(200);
  const afterWheel = await sideAt();
  record(
    "a wheel gesture over the sidebar does not scroll the document",
    afterWheel.scrollY === 0,
    `scrollY=${afterWheel.scrollY}`,
  );

  /* The tooltip is a pseudo-element, so only a real hover can prove it appears.
     Reading the computed opacity of ::after is the difference between asserting
     the rule exists and asserting the user would see it. */
  await probe.locator(".sidebar-toggle").hover();
  await probe.waitForTimeout(250);
  const tipOpacity = await probe.evaluate(
    () => getComputedStyle(document.querySelector(".sidebar-toggle"), "::after").opacity,
  );
  record(
    "the collapse toggle reveals its tooltip on hover",
    tipOpacity === "1",
    `::after opacity=${tipOpacity}`,
  );

  /* Collapsing has to hide the wordy content and keep the one control that can
     undo it. Asserted together, because a rail that hides both is unrecoverable
     and a rail that hides neither is not collapsed. */
  await probe.locator(".sidebar-toggle").click();
  await probe.waitForTimeout(350);
  const collapsedRail = await probe.evaluate(() => {
    const shown = (el) => Boolean(el) && el.getClientRects().length > 0;
    const rail = document.querySelector(".side");
    return {
      railWidth: Math.round(rail.getBoundingClientRect().width),
      contentVisible: shown(document.querySelector(".side-scroll")),
      toggleVisible: shown(document.querySelector(".sidebar-toggle")),
      bellVisible: shown(document.querySelector(".notif-sidebar")),
    };
  });
  record(
    "collapsing hides the sidebar's text content but keeps the icon toggle",
    collapsedRail.railWidth === 72 &&
      collapsedRail.contentVisible === false &&
      collapsedRail.toggleVisible === true,
    JSON.stringify(collapsedRail),
  );

  await probe.close();

  // ------------------------------------------------------- collapse toggle icon
  const withToggle = allMeasures.filter((m) => m.toggle);
  record(
    "every screen exposes a measurable collapse toggle",
    withToggle.length === allMeasures.length,
    `measured ${withToggle.length}/${allMeasures.length}`,
  );

  /* An icon-only button has no visible word left to explain it, so the text
     node and the tooltip both have to be absent/present exactly as declared. */
  const textyToggle = withToggle
    .filter((m) => m.toggle.text !== "" || !m.toggle.hasSvg)
    .map((m) => `${m.route}@${m.viewport}px text="${m.toggle.text}" svg=${m.toggle.hasSvg}`);
  record(
    "the collapse toggle is an icon with no text label",
    textyToggle.length === 0,
    textyToggle.slice(0, 4).join(" | "),
  );

  /* aria-label and data-tooltip are rendered from one variable; if they drift,
     the tooltip starts describing a different action than the button performs. */
  const mismatchedLabels = withToggle
    .filter((m) => !m.toggle.tooltip || m.toggle.tooltip !== m.toggle.ariaLabel)
    .map((m) => `${m.route}@${m.viewport}px tooltip="${m.toggle.tooltip}" label="${m.toggle.ariaLabel}"`);
  record(
    "the collapse toggle's tooltip matches its accessible name",
    mismatchedLabels.length === 0,
    mismatchedLabels.slice(0, 4).join(" | "),
  );

  const crampedToggle = withToggle
    .filter((m) => m.viewport <= MOBILE_BREAKPOINT && (m.toggle.width < TOUCH_TARGET || m.toggle.height < TOUCH_TARGET))
    .map((m) => `${m.route}@${m.viewport}px toggle=${m.toggle.width}x${m.toggle.height}`);
  record(
    "the collapse toggle meets the touch target on narrow screens",
    crampedToggle.length === 0,
    crampedToggle.slice(0, 4).join(" | "),
  );

  // ---------------------------------------------------------- side-by-side bands
  const fieldDrift = fetches.flatMap((m) =>
    m.fieldRows.flatMap((grid) =>
      grid.rows.flatMap((row) => {
        const tops = new Set(row.map((control) => control.controlTop));
        if (tops.size <= 1) return [];
        return [
          `${m.route}@${m.viewport}px "${grid.caption}" controls in one row start at ${[...tops].sort((a, b) => a - b).join(", ")}`,
        ];
      }),
    ),
  );
  record(
    "form controls in the same row share a top edge",
    fieldDrift.length === 0,
    fieldDrift.slice(0, 4).join(" | "),
  );

  const splitDrift = fetches.flatMap((m) =>
    m.splitRows.flatMap((children) => {
      const problems = [];
      for (let i = 0; i < children.length; i += 1) {
        for (let j = i + 1; j < children.length; j += 1) {
          const a = children[i];
          const b = children[j];
          const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlap <= Math.min(a.height, b.height) / 2) continue;
          if (Math.abs(a.top - b.top) > EPSILON) {
            problems.push(
              `${m.route}@${m.viewport}px side-by-side items start at ${a.top} and ${b.top}`,
            );
          }
        }
      }
      return problems;
    }),
  );
  record(
    "panels sitting side by side share a top edge",
    splitDrift.length === 0,
    splitDrift.slice(0, 4).join(" | "),
  );

  await browser.close();
  await context.close().catch(() => {});

  const failed = results.filter((entry) => !entry.ok);
  for (const entry of results) {
    console.log(`  [${entry.ok ? "PASS" : "FAIL"}] ${entry.label}`);
    if (!entry.ok && entry.detail) console.log(`         ${entry.detail}`);
  }
  console.log(`${results.length - failed.length}/${results.length} checks passed`);

  if (failed.length > 0) process.exit(1);
}

await main();
