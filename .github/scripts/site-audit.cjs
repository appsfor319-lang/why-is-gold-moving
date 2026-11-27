const { chromium, devices } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const base = process.env.SITE_URL || "https://appsfor319-lang.github.io/why-is-gold-moving/";
const out = path.resolve("audit-output");
fs.mkdirSync(out, { recursive: true });

const evidence = {
  url: base,
  started_at: new Date().toISOString(),
  page_errors: [],
  console_errors: [],
  failed_requests: [],
  bad_responses: [],
  checks: [],
};

function check(name, pass, detail) {
  evidence.checks.push({ name, pass: Boolean(pass), detail: detail ?? null });
  console.log((pass ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
}

(async () => {
  // The Pages deployment and this audit are triggered by the same push.
  // Wait until the public CDN is serving the exact fixed renderer before testing.
  const expectedRendererMarker = 'async function refreshLiveIntelligence(force=false)';
  let deploymentReady = false;
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const asset = new URL("outlook.js?v=live14&deploy_audit=" + Date.now(), base);
      const chartAsset = new URL("chart.js?v=shock10&deploy_audit=" + Date.now(), base);
      const [response, chartResponse] = await Promise.all([
        fetch(asset, { cache: "no-store" }),
        fetch(chartAsset, { cache: "no-store" })
      ]);
      const [source, chartSource] = await Promise.all([
        response.ok ? response.text() : Promise.resolve(""),
        chartResponse.ok ? chartResponse.text() : Promise.resolve("")
      ]);
      if (response.ok && chartResponse.ok && source.includes(expectedRendererMarker) && chartSource.includes("lastGoldShockAnalysisAt")) {
        deploymentReady = true;
        console.log("PASS Public Pages is serving the fixed outlook renderer");
        break;
      }
      console.log("Waiting for Pages deployment (" + attempt + "/30) · HTTP " + response.status);
    } catch (error) {
      console.log("Waiting for Pages deployment (" + attempt + "/30) · " + error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  if (!deploymentReady) throw new Error("GitHub Pages did not publish the fixed outlook renderer within five minutes");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on("pageerror", e => evidence.page_errors.push(String(e.stack || e)));
    page.on("console", msg => { if (msg.type() === "error") evidence.console_errors.push(msg.text()); });
    page.on("requestfailed", req => evidence.failed_requests.push({ url: req.url(), error: req.failure()?.errorText }));
    page.on("response", res => { if (res.status() >= 400) evidence.bad_responses.push({ status: res.status(), url: res.url() }); });

    let response;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        response = await page.goto(base + "?audit=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 45000 });
        if (response && response.ok()) break;
      } catch (e) {
        if (attempt === 8) throw e;
      }
      await page.waitForTimeout(5000);
    }
    check("Live website responds", !!response && response.ok(), response ? "HTTP " + response.status() : "No response");
    await page.waitForTimeout(12000);

    const snapshot = await page.evaluate(async () => {
      const ids = ["outlook-status","destination-updated","destination-bias","destination-bottomline",
        "outlook-direction","outlook-summary","outlook-stuck","outlook-next-target",
        "outlook-levels","outlook-scenarios","outlook-consensus","outlook-sources","chart-feed-status","chart-last-price","short-term-synthesis","horizon-long-panel","live-intelligence","live-intelligence-price","live-move-headline","live-tradingview-ideas","tradingview-feed-status"];
      const text = id => document.getElementById(id)?.innerText?.trim() || "";
      let research = null, researchStatus = null;
      try {
        const r = await fetch("./research/where-gold-going-latest.json?browser_audit=" + Date.now(), { cache: "no-store" });
        researchStatus = r.status;
        if (r.ok) research = await r.json();
      } catch (e) { researchStatus = String(e); }
      return {
        title: document.title,
        heading: document.querySelector("h1")?.innerText || "",
        script: [...document.scripts].map(s => s.src).filter(s => s.includes("outlook.js")),
        researchStatus,
        research: research ? {
          updated_at: research.updated_at,
          bias: research.bias,
          levels: research.levels?.length || 0,
          paths: research.paths?.length || 0,
          professional_views: research.professional_views?.length || 0,
          community_views: research.community_views?.length || 0,
          sources: research.sources?.length || 0
        } : null,
        panels: Object.fromEntries(ids.map(id => [id, text(id)])),
        chart: { status: text("chart-feed-status"), price: text("chart-last-price"), canvases: document.querySelectorAll("#xau-chart canvas").length },
        tabCount: document.querySelectorAll(".horizon-tab").length,
        longHidden: document.getElementById("horizon-long-panel")?.hidden === true,
        horizonButtonsVisible: [...document.querySelectorAll(".horizon-tab")].every(b => getComputedStyle(b).display !== "none" && b.getBoundingClientRect().height > 30),
        livePanelVisible: !!document.getElementById("live-intelligence") && getComputedStyle(document.getElementById("live-intelligence")).display !== "none",
        staticShortSnapshotHidden: getComputedStyle(document.getElementById("gold-destination")).display === "none",
        counts: {
          levels: document.querySelectorAll("#outlook-levels .outlook-level").length,
          scenarios: document.querySelectorAll("#outlook-scenarios .outlook-scenario").length,
          consensusCards: document.querySelectorAll("#outlook-consensus .outlook-source").length,
          sourceCards: document.querySelectorAll("#outlook-sources .outlook-source").length
        },
        visible: {
          outlook: !!document.querySelector("#pane-outlook") && getComputedStyle(document.querySelector("#pane-outlook")).display !== "none",
          levels: !!document.querySelector("#outlook-levels"),
          scenarios: !!document.querySelector("#outlook-scenarios")
        }
      };
    });
    evidence.snapshot = snapshot;

    check("Correct page title", /why is gold moving/i.test(snapshot.title), snapshot.title);
    check("Published research JSON loads", snapshot.researchStatus === 200, String(snapshot.researchStatus));
    check("Dashboard scripts are loaded", snapshot.script.some(s => /outlook\.js\?v=live14/.test(s)) && snapshot.script.some(s => /app\.js\?v=chart6/.test(s)) && snapshot.script.some(s => /chart\.js\?v=shock10/.test(s)), snapshot.script.join(", "));
    check("Research timestamp appears in live UI", !!snapshot.panels["outlook-status"] && /Published research/i.test(snapshot.panels["outlook-status"]), snapshot.panels["outlook-status"]);
    check("Short-term conclusion and conditional target render", snapshot.panels["short-term-synthesis"].includes("$3,500") && snapshot.panels["short-term-synthesis"].includes("$3,426.80"), snapshot.panels["short-term-synthesis"]);
    check("Long-term analyst forecasts and COT positioning render", /Professional forecasts supporting the long-term view/.test(snapshot.panels["horizon-long-panel"]) && /Managed Money net/.test(snapshot.panels["horizon-long-panel"]), snapshot.panels["horizon-long-panel"].slice(0, 500));
    check("Both horizon tabs are present", snapshot.tabCount === 2 && snapshot.longHidden === true, "Short and long term tabs");
    check("Both horizon controls are visibly rendered", snapshot.horizonButtonsVisible, "Visible two-button horizon switcher");
    check("Live intelligence panel is visible", snapshot.livePanelVisible, snapshot.panels["live-intelligence"].slice(0, 180));
    check("Dated short-term snapshot is hidden from live view", snapshot.staticShortSnapshotHidden, "Old snapshot price map is not presented as current");
    await page.locator("#tab-long-term").click();
    const longTabWorks = await page.locator("#horizon-long-panel").evaluate(el => !el.hidden && getComputedStyle(el).display !== "none");
    await page.screenshot({ path: path.join(out, "long-term-tab.png"), fullPage: true });
    await page.locator("#tab-short-term").click();
    const shortTabWorks = await page.locator("#horizon-short-panel").evaluate(el => !el.hidden && getComputedStyle(el).display !== "none");
    check("Horizon tabs switch panels in both directions", longTabWorks && shortTabWorks, "Long panel opens and short panel returns");


    check("Price levels render", snapshot.counts.levels >= 1 && snapshot.counts.levels === snapshot.research?.levels, snapshot.counts.levels + " rendered / " + snapshot.research?.levels + " in JSON");
    check("Scenarios render", snapshot.counts.scenarios >= 1 && snapshot.counts.scenarios === snapshot.research?.paths, snapshot.counts.scenarios + " rendered / " + snapshot.research?.paths + " in JSON");
    check("Professional/community views render", snapshot.counts.consensusCards >= (snapshot.research?.professional_views || 0), snapshot.counts.consensusCards + " cards");
    check("Source links render", snapshot.counts.sourceCards >= 1 && snapshot.counts.sourceCards === snapshot.research?.sources, snapshot.counts.sourceCards + " rendered / " + snapshot.research?.sources + " in JSON");
    check("No old empty-state placeholders remain", !/No sourced levels yet|No scenarios loaded|No source list yet|Scenario analysis is not active|Professional\/social consensus collection is not connected/i.test(
      [snapshot.panels["outlook-levels"], snapshot.panels["outlook-scenarios"], snapshot.panels["outlook-consensus"], snapshot.panels["outlook-sources"]].join("\n")
    ), "Checks the four research panels");
    check("Chart canvas renders", snapshot.chart.canvases >= 1, snapshot.chart.canvases + " canvas elements");
    check("Chart receives candle data", snapshot.chart.price !== "—" && !/FEED ERROR|Connecting/i.test(snapshot.chart.status), snapshot.chart.status + " · " + snapshot.chart.price);
    check("No uncaught browser JavaScript errors", evidence.page_errors.length === 0, evidence.page_errors.slice(0, 3).join(" | ") || "None");

    await page.screenshot({ path: path.join(out, "desktop-full.png"), fullPage: true });
    await page.screenshot({ path: path.join(out, "desktop-top.png"), fullPage: false });

    const mobile = await browser.newPage({ ...devices["iPhone 13"] });
    mobile.on("pageerror", e => evidence.page_errors.push("MOBILE: " + String(e.stack || e)));
    await mobile.goto(base + "?audit_mobile=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 45000 });
    await mobile.waitForTimeout(10000);
    await mobile.screenshot({ path: path.join(out, "mobile-full.png"), fullPage: true });
    evidence.mobile = await mobile.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
      title: document.title
    }));
    check("Mobile layout has no horizontal overflow", !evidence.mobile.horizontalOverflow,
      evidence.mobile.width + "px viewport / " + evidence.mobile.documentWidth + "px document");

    evidence.finished_at = new Date().toISOString();
    evidence.result = evidence.checks.every(c => c.pass) ? "PASS" : "FAIL";
    fs.writeFileSync(path.join(out, "audit-report.json"), JSON.stringify(evidence, null, 2));
    fs.writeFileSync(path.join(out, "audit-report.txt"),
      "LIVE WEBSITE AUDIT: " + evidence.result + "\n" +
      evidence.checks.map(c => (c.pass ? "PASS " : "FAIL ") + c.name + (c.detail ? " — " + c.detail : "")).join("\n") +
      "\n\nPAGE ERRORS\n" + (evidence.page_errors.join("\n") || "None") +
      "\n\nCONSOLE ERRORS\n" + (evidence.console_errors.join("\n") || "None") +
      "\n\nFAILED REQUESTS\n" + (JSON.stringify(evidence.failed_requests, null, 2)) +
      "\n\nBAD HTTP RESPONSES\n" + (JSON.stringify(evidence.bad_responses, null, 2)) +
      "\n\nMOBILE\n" + JSON.stringify(evidence.mobile, null, 2) + "\n");
    if (evidence.result !== "PASS") process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => {
  evidence.fatal_error = String(error.stack || error);
  evidence.result = "ERROR";
  evidence.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(out, "audit-report.json"), JSON.stringify(evidence, null, 2));
  console.error(error);
  process.exitCode = 1;
});
