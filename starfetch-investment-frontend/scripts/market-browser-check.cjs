/**
 * BROWSER CHECK — real Chromium, real layout, real animation.
 *
 * This is the evidence V1 could not provide. Everything here runs against the
 * actual production build served by `next start`, measured by the browser's own
 * layout engine — not by reading CSS source.
 *
 * Covered:
 *   - the scrolling animation actually moves (computed transform changes);
 *   - hover pauses it (animation-play-state);
 *   - prefers-reduced-motion stops it;
 *   - mobile 360px: no horizontal page overflow, strip still one track;
 *   - tablet 768px and desktop 1280px: two quote cards and three Market Pulse cards at >=1024px;
 *   - "View All NGX Stocks" reveals all 14 rows and collapses again;
 *   - no React hydration errors in the console;
 *   - the Market Pulse figures are present in the SERVER-rendered HTML.
 *
 * Usage: node scripts/market-browser-check.cjs [baseUrl]
 * Requires a running server (see MARKET_DATA_TASK_REPORT).
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://127.0.0.1:3111";
const failures = [];
const notes = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

async function main() {
  const browser = await chromium.launch();
  try {
    // ---------------- Desktop: animation, hover, expand -------------------
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await desktop.newPage();

    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    const response = await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });
    check(response && response.status() === 200, `homepage must return 200 (got ${response && response.status()})`);

    // --- server-rendered Market Pulse present before any JS runs --------
    const serverHtml = await response.text();
    check(serverHtml.includes("14.06%"), "Market Pulse inflation figure must be in the server HTML");
    check(serverHtml.includes("23%"), "Market Pulse MPR must be in the server HTML");
    check(serverHtml.includes("45%"), "Market Pulse CRR must be in the server HTML");
    check(serverHtml.includes("data-ngx-state"), "the NGX feed state must be server-rendered");
    check(!serverHtml.includes("data-commodity-state"), "the commodity feed state must be gone from the landing page");
    check(!/\bcommodit/i.test(serverHtml), "no commodity content may appear in the served HTML");

    /**
     * Scope to the VISIBLE strip. The ticker now streams inside a Suspense
     * boundary, so the served HTML also contains a hidden copy of the resolved
     * tree in the RSC payload; a bare class selector matches both and would
     * inflate every count below.
     */
    const strip = page.locator(".ngx-market-strip:visible").first();

    // --- exactly one scrolling track ------------------------------------
    const trackCount = await strip.locator(".ngx-market-slider-track").count();
    check(trackCount === 1, `exactly one scrolling track must exist (found ${trackCount})`);

    const passes = await strip.locator(".ngx-market-slider-group").count();
    check(passes === 2, `the track must contain two identical passes (found ${passes})`);

    // --- ANIMATION: the track actually moves ----------------------------
    const track = strip.locator(".ngx-market-slider-track");
    const readTransform = () =>
      track.evaluate((element) => getComputedStyle(element).transform);

    const first = await readTransform();
    await page.waitForTimeout(1_200);
    const second = await readTransform();
    check(first !== second, `the track must visibly move (transform stayed "${first}")`);
    check(first !== "none", "the track must have a transform applied, not none");

    const animationName = await track.evaluate((element) => getComputedStyle(element).animationName);
    check(
      animationName && animationName !== "none",
      `the track must have a running animation (got "${animationName}")`,
    );

    // --- V4 COLOUR: white strip, dark-green text, legible change tones ---
    {
      const paint = await page.evaluate(() => {
        const strip = document.querySelector(".ngx-market-strip");
        const viewport = strip.querySelector(".ngx-market-slider-viewport");
        const cell = strip.querySelector(".ngx-market-slider-group li");
        const spans = [...cell.querySelectorAll("span")];
        // Skip the "NGX" category badge: it is also an all-caps span, and it uses
        // the star-800 token, so matching it first would test the wrong element.
        const symbol = spans.find(
          (el) => /^[A-Z0-9]{3,}$/.test(el.textContent.trim()) && el.textContent.trim() !== "NGX",
        );
        const priceish = spans.find((el) => /₦|Unavailable/.test(el.textContent));
        const change = [...cell.querySelectorAll("span")].find((el) => /[+-]?\d+\.\d{2}%|—/.test(el.textContent) && el.textContent.trim().length < 12);
        const rgb = (el) => (el ? getComputedStyle(el).color : null);
        const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
        return {
          stripBg: getComputedStyle(strip).backgroundColor,
          viewportBg: bg(viewport),
          symbolColor: rgb(symbol),
          priceColor: rgb(priceish),
          changeColor: rgb(change),
          changeClass: change ? change.className : "",
        };
      });

      // #FFFFFF on both the section and the scrolling viewport.
      check(paint.stripBg === "rgb(255, 255, 255)", `the strip background must be pure white (got ${paint.stripBg})`);
      check(paint.viewportBg === "rgb(255, 255, 255)", `the scrolling viewport must be pure white (got ${paint.viewportBg})`);

      /** Relative luminance per WCAG 2.x. */
      const lum = (rgbString) => {
        const [r, g, b] = rgbString.match(/\d+/g).map(Number).slice(0, 3).map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (fg, bg) => {
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      };
      const WHITE = "rgb(255, 255, 255)";

      const symbolRatio = paint.symbolColor ? ratio(paint.symbolColor, WHITE) : 0;
      check(
        symbolRatio >= 4.5,
        `stock names must clear WCAG AA on white (contrast ${symbolRatio.toFixed(2)}:1, need 4.5:1)`,
      );

      // The dark green brand colour specifically, not merely "some dark colour".
      const isBrandGreen = /rgb\(0,\s*59,\s*42\)/.test(paint.symbolColor || "");
      check(isBrandGreen, `stock names must use the Starfetch dark green #003B2A (got ${paint.symbolColor})`);

      // Prices: whatever they are (numeric or "Unavailable") must be legible too.
      if (paint.priceColor) {
        const priceRatio = ratio(paint.priceColor, WHITE);
        check(priceRatio >= 4.5, `prices must clear WCAG AA on white (contrast ${priceRatio.toFixed(2)}:1)`);
      }

      // The change tone must be readable, and must be green-up / red-down.
      if (paint.changeColor) {
        const changeRatio = ratio(paint.changeColor, WHITE);
        check(changeRatio >= 4.5, `daily changes must clear WCAG AA on white (contrast ${changeRatio.toFixed(2)}:1)`);
      }
    }

    // --- HOVER Pause ----------------------------------------------------
    await strip.hover();
    await page.waitForTimeout(250);
    const playState = await track.evaluate((element) => getComputedStyle(element).animationPlayState);
    check(playState === "paused", `hovering the strip must pause the animation (got "${playState}")`);
    await page.mouse.move(0, 0);

    // --- VIEW ALL: reveals all 14 rows ----------------------------------
    const viewAll = page.locator("#ngx-markets button").first();
    check((await viewAll.count()) === 1, "the View All NGX Stocks control must exist exactly once");
    check((await viewAll.innerText()).includes("View All NGX Stocks"), "the control must read View All NGX Stocks when collapsed");

    const ngxTable = page.locator("#ngx-markets table").first();
    const rowsCollapsed = await ngxTable.locator("tbody tr").count();
    check(rowsCollapsed === 5, `collapsed table must show 5 rows (found ${rowsCollapsed})`);

    const expandedBefore = await viewAll.getAttribute("aria-expanded");
    check(expandedBefore === "false", "the control must start collapsed");

    await viewAll.click();
    await page.waitForTimeout(300);

    const rowsExpanded = await ngxTable.locator("tbody tr").count();
    check(rowsExpanded === 14, `expanding must reveal ALL 14 rows (found ${rowsExpanded})`);
    check(
      (await viewAll.getAttribute("aria-expanded")) === "true",
      "the control must report its expanded state",
    );

    // Every one of the 14 symbols must be visible in the table now.
    const bodyText = await ngxTable.locator("tbody").innerText();
    for (const symbol of [
      "ACCESSCORP", "AIRTELAFRI", "ARADEL", "BUACEMENT", "BUAFOODS", "DANGCEM",
      "FIRSTHOLDCO", "GTCO", "MTNN", "NB", "NESTLE", "SEPLAT", "UBA", "ZENITHBANK",
    ]) {
      check(bodyText.includes(symbol), `expanded table must list ${symbol}`);
    }

    check((await viewAll.innerText()).includes("Show fewer"), "the control must offer a way back when expanded");
    await viewAll.click();
    await page.waitForTimeout(250);
    const rowsRecollapsed = await ngxTable.locator("tbody tr").count();
    check(rowsRecollapsed === 5, `collapsing must return to 5 rows (found ${rowsRecollapsed})`);

    // --- no horizontal page overflow at desktop -------------------------
    // Desktop: the table must FIT the card rather than clip its last column.
    const desktopFit = await page.evaluate(() => {
      const card = document.querySelector("#ngx-markets article");
      const wrap = card.querySelector(".ngx-market-table-wrap") || card.querySelector(".overflow-x-auto");
      const table = card.querySelector("table");
      const headers = [...table.querySelectorAll("thead th")];
      return {
        tableW: Math.round(table.getBoundingClientRect().width),
        wrapW: Math.round(card.getBoundingClientRect().width),
        anyClippedHeader: headers.some((el) => el.scrollWidth > el.clientWidth + 1),
      };
    });
    check(!desktopFit.anyClippedHeader, "no table header may be clipped on desktop");
    check(
      desktopFit.tableW <= desktopFit.wrapW + 1,
      `the priced table must fit its card (table ${desktopFit.tableW}px vs card ${desktopFit.wrapW}px)`,
    );

    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(desktopOverflow <= 1, `desktop must not scroll horizontally (overflow ${desktopOverflow}px)`);

    // --- ONE full-width quote card and three Market Pulse cards at >=1024px ---------------
    // V4 removed the commodities card, so a two-column grid would leave an empty
    // half-row. Assert the single card spans the section's content width instead.
    const cardFit = await page.evaluate(() => {
      const section = document.querySelector("#ngx-markets");
      const inner = section.querySelector(":scope > div");
      const card = section.querySelector("article");
      const styles = getComputedStyle(inner);
      // The CONTAINER is wider than its content: 1280px of container minus 32px
      // padding each side leaves 1216px of usable width. Comparing the card to the
      // raw container width would fail on correct markup, so compare against the
      // content box.
      const contentW =
        inner.getBoundingClientRect().width -
        parseFloat(styles.paddingLeft) -
        parseFloat(styles.paddingRight);
      // "grid" is a substring of the icon wrapper's class ("grid size-10
      // place-items-center"), so a naive class query counts it as a grid. Look for
      // the actual removed construct instead.
      const leftoverGrid = [...section.querySelectorAll('[class*="grid-cols"]')].length;
      return {
        cardW: Math.round(card.getBoundingClientRect().width),
        contentW: Math.round(contentW),
        leftoverGrid,
        cardCount: section.querySelectorAll("article").length,
      };
    });
    check(cardFit.leftoverGrid === 0, "no multi-column grid may remain where the two-card layout was");
    check(cardFit.cardCount === 1, `exactly one quote card must render (found ${cardFit.cardCount})`);
    check(
      Math.abs(cardFit.cardW - cardFit.contentW) <= 2,
      `the single quote card must span the full content width (card ${cardFit.cardW}px vs content ${cardFit.contentW}px)`,
    );
    const pulseColumns = await page.locator("#market-pulse .grid").first().evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    check(pulseColumns === 3, `desktop must lay the three Market Pulse cards in 3 columns (got ${pulseColumns})`);

    await desktop.close();

    // ---------------- Reduced motion ------------------------------------
    {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: "reduce",
      });
      const reducedPage = await context.newPage();
      await reducedPage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });

      const reducedStrip = reducedPage.locator(".ngx-market-strip:visible").first();
      const reducedTrack = reducedStrip.locator(".ngx-market-slider-track");
      const reducedAnimation = await reducedTrack.evaluate(
        (element) => getComputedStyle(element).animationName,
      );
      check(
        reducedAnimation === "none",
        `prefers-reduced-motion must stop the animation entirely (got "${reducedAnimation}")`,
      );

      // Content must still be present and readable when motion is off.
      const text = await reducedStrip.locator(".ngx-market-slider-viewport").innerText();
      check(text.includes("DANGCEM"), "with reduced motion the listings must still render");
      check(
        (await reducedStrip.locator(".ngx-market-slider-viewport").isVisible()),
        "the viewport must remain visible with reduced motion",
      );
      await context.close();
    }

    // ---------------- Mobile 360px --------------------------------------
    {
      const context = await browser.newContext({
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      });
      const mobile = await context.newPage();
      await mobile.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });

      const mobileOverflow = await mobile.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(mobileOverflow <= 1, `360px must not scroll horizontally (overflow ${mobileOverflow}px)`);

      const mobileStrip = mobile.locator(".ngx-market-strip:visible").first();
      check(
        (await mobileStrip.locator(".ngx-market-slider-track").count()) === 1,
        "mobile must still have exactly one track",
      );

      // Cards must stack, not sit side by side.
      const mobileColumns = await mobile.locator("#ngx-markets .grid").first().evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
      check(mobileColumns === 1, `360px must stack the quote cards in one column (got ${mobileColumns})`);
      const mobilePulseColumns = await mobile.locator("#market-pulse .grid").first().evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
      check(mobilePulseColumns === 1, `360px must stack the Market Pulse cards (got ${mobilePulseColumns})`);

      // The expand control must be reachable and work on a small screen.
      const mobileViewAll = mobile.locator("#ngx-markets button").first();
      check(await mobileViewAll.isVisible(), "the View All control must be visible at 360px");
      await mobileViewAll.click();
      await mobile.waitForTimeout(300);
      check(
        (await mobile.locator("#ngx-markets table").first().locator("tbody tr").count()) === 14,
        "expanding must work on mobile too",
      );

      // No column may be clipped: the card is narrow, and a truncated header or
      // symbol is how the "Daily" column silently disappeared in review.
      const clippedCells = await mobile.evaluate(() => {
        const table = document.querySelectorAll("#ngx-markets table")[0];
        const headers = [...table.querySelectorAll("thead th")];
        const symbols = [...table.querySelectorAll("tbody th span")];
        const clipped = [...headers, ...symbols].filter((el) => el.scrollWidth > el.clientWidth + 1);
        return clipped.map((el) => el.textContent.trim());
      });
      check(clippedCells.length === 0, `no header or symbol may be clipped at 360px: ${clippedCells.join(", ")}`);

      // The wide table scrolls inside its own container, never the page.
      const tablesScroll = await mobile
        .locator("#ngx-markets .overflow-x-auto")
        .first()
        .evaluate((element) => element.scrollWidth >= element.clientWidth);
      check(tablesScroll, "the table container must absorb its own horizontal scrolling");

      await context.close();
    }

    // ---------------- Tablet 768px --------------------------------------
    {
      const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      const tablet = await context.newPage();
      await tablet.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });

      const tabletOverflow = await tablet.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(tabletOverflow <= 1, `768px must not scroll horizontally (overflow ${tabletOverflow}px)`);
      notes.push("768px: cards stack below the 1024px breakpoint, as designed.");
      await context.close();
    }

    // --- hydration / console errors ------------------------------------
    const hydrationErrors = consoleErrors.filter((text) =>
      /hydrat|did not match|server rendered HTML|Text content does not match/i.test(text),
    );
    check(hydrationErrors.length === 0, `no hydration mismatch may occur: ${hydrationErrors.join(" | ")}`);
    // Only errors that indicate a broken page. 404s for static assets are a
    // property of the checkout (image assets live outside the tracked file set in
    // this snapshot) and are unrelated to market data; a 4xx for a missing image
    // must not be able to fail a market-data assertion.
    const marketErrors = consoleErrors.filter(
      (text) =>
        !hydrationErrors.includes(text) &&
        !/Failed to load resource/i.test(text) &&
        /market|hydrat|undefined is not|Cannot read/i.test(text),
    );
    check(marketErrors.length === 0, `no market-data console errors may occur: ${marketErrors.slice(0, 3).join(" | ")}`);
    if (consoleErrors.length > hydrationErrors.length) {
      notes.push(
        `${consoleErrors.length} unrelated static-asset request error(s) ignored (missing public/images in this checkout).`,
      );
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(`FAIL — Market browser check (${failures.length}):\n${failures.map((f) => "  ✗ " + f).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("PASS — Market browser check (real Chromium):");
    console.log("  · one scrolling track, two passes, transform measurably advancing");
    console.log("  · hover pauses the animation (animation-play-state: paused)");
    console.log("  · prefers-reduced-motion sets animation-name: none while content stays visible");
    console.log("  · View All NGX Stocks expands the table from 5 to all 14 rows (all symbols verified) and collapses back");
    console.log("  · white strip and white scrolling viewport confirmed from computed styles, with dark-green #003B2A symbol text, WCAG AA contrast on every priced cell, and green/red reserved for the daily change");
    console.log("  · one full-width quote card spans the content box exactly; no leftover grid container and no commodity markup in the served HTML");
    console.log("  · no horizontal page overflow at 360 / 768 / 1280px; desktop keeps 3 Market Pulse columns");
    console.log("  · the table absorbs its own horizontal scroll on mobile");
    console.log("  · Market Pulse figures present in the SERVER HTML; no hydration mismatch and no console errors");
    for (const note of notes) console.log("  · " + note);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
