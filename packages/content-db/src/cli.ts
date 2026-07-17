import path from "node:path";
import { openDatabase } from "./db";
import {
  buildParserQaReport,
  exportContentEntitiesJson,
  exportScrapedFeatRulesJson,
  exportUsableContentJson,
} from "./exporter";
import { seedLocalRulesData } from "./seed-local";
import {
  refreshCachedAonClassFeatures,
  refreshCachedAonFeats,
  refreshCachedAonMagicItems,
  refreshCachedAonSpells,
  scrapeAonArmor,
  scrapeAonBaseClassFeatures,
  scrapeAonClassFeatures,
  scrapeAonFeatCatalog,
  scrapeAonFeats,
  scrapeAonGear,
  scrapeAonMagicItemUrls,
  scrapeAonRaceCatalog,
  scrapeAonRaces,
  scrapeAonRings,
  scrapeAonRods,
  scrapeAonSpells,
  scrapeAonStaves,
  scrapeAonWeapons,
  scrapeAonWondrousItems,
} from "./scrape";

function defaultUsableExportPath() {
  return path.resolve(process.cwd(), "data", "exports", "usable-content.json");
}

function exportUsableSnapshot(db: ReturnType<typeof openDatabase>) {
  const outPath = defaultUsableExportPath();
  const result = exportUsableContentJson(db, outPath);
  console.log(`Auto-exported usable content JSON to ${outPath}.`);
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const command = process.argv[2];
  const db = openDatabase();
  try {
    if (command === "init") {
      console.log(`DB ready at ${db.name}`);
      return;
    }
    if (command === "seed-local") {
      seedLocalRulesData(db);
      const count = db
        .prepare(
          "SELECT COUNT(*) as count FROM content_entities WHERE origin = 'seed'",
        )
        .get() as { count: number };
      console.log(`Seeded ${count.count} canonical entities from rules-data.`);
      return;
    }
    if (command === "export-content-json") {
      const outPath = process.argv[3]
        ? path.resolve(process.cwd(), process.argv[3])
        : path.resolve(
            process.cwd(),
            "data",
            "exports",
            "content-entities.json",
          );
      const summary = exportContentEntitiesJson(db, outPath);
      console.log(`Exported ${summary.total} content entities to ${outPath}.`);
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    if (command === "export-feat-rules-json") {
      const outPath = process.argv[3]
        ? path.resolve(process.cwd(), process.argv[3])
        : path.resolve(
            process.cwd(),
            "data",
            "exports",
            "aon-feats.rules.json",
          );
      const result = exportScrapedFeatRulesJson(db, outPath);
      console.log(`Exported ${result.featCount} scraped feats to ${outPath}.`);
      return;
    }
    if (command === "export-usable-json") {
      const outPath = process.argv[3]
        ? path.resolve(process.cwd(), process.argv[3])
        : defaultUsableExportPath();
      const result = exportUsableContentJson(db, outPath);
      console.log(`Exported usable content JSON to ${outPath}.`);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (command === "report-parser-qa") {
      const report = buildParserQaReport(db);
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    if (command === "scrape-aon-spells") {
      const className = process.argv[3] ?? "Wizard";
      const limitArg = process.argv[4];
      const limit = limitArg ? Number(limitArg) : undefined;
      const imported = await scrapeAonSpells(
        db,
        className,
        Number.isFinite(limit) ? limit : undefined,
      );
      console.log(`Scraped ${imported} AoN spell pages for ${className}.`);
      exportUsableSnapshot(db);
      return;
    }
    if (command === "refresh-cached-aon-spells") {
      const limitArg = process.argv[3];
      const limit = limitArg ? Number(limitArg) : undefined;
      const result = await refreshCachedAonSpells(
        db,
        Number.isFinite(limit) ? limit : undefined,
      );
      console.log(
        `Refreshed ${result.refreshed} cached AoN spell rows (${result.skipped} skipped, ${result.scanned} scanned).`,
      );
      exportUsableSnapshot(db);
      return;
    }
    if (command === "refresh-cached-aon-feats") {
      const limitArg = process.argv[3];
      const limit = limitArg ? Number(limitArg) : undefined;
      const result = await refreshCachedAonFeats(
        db,
        Number.isFinite(limit) ? limit : undefined,
      );
      console.log(
        `Refreshed ${result.refreshed} cached AoN feat rows (${result.skipped} skipped, ${result.scanned} scanned).`,
      );
      exportUsableSnapshot(db);
      return;
    }
    if (command === "refresh-cached-aon-magic-items") {
      const limitArg = process.argv[3];
      const limit = limitArg ? Number(limitArg) : undefined;
      const result = await refreshCachedAonMagicItems(
        db,
        Number.isFinite(limit) ? limit : undefined,
      );
      console.log(
        `Refreshed ${result.refreshed} cached AoN magic-item rows (${result.skipped} skipped, ${result.scanned} scanned).`,
      );
      exportUsableSnapshot(db);
      return;
    }
    if (command === "refresh-cached-aon-class-features") {
      const limitArg = process.argv[3];
      const limit = limitArg ? Number(limitArg) : undefined;
      const result = await refreshCachedAonClassFeatures(
        db,
        Number.isFinite(limit) ? limit : undefined,
      );
      console.log(
        `Refreshed ${result.refreshed} cached AoN class-feature rows (${result.skipped} skipped, ${result.scanned} scanned, ${result.pages} pages).`,
      );
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-feats") {
      const categoryArg = process.argv[3];
      const limitArg =
        process.argv[4] ??
        (categoryArg === "all" ? process.argv[4] : undefined);
      const limit = limitArg ? Number(limitArg) : undefined;
      if (!categoryArg || categoryArg === "all") {
        const result = await scrapeAonFeatCatalog(db, {
          limitPerCategory: Number.isFinite(limit) ? limit : undefined,
        });
        console.log(
          `Scraped ${result.total} AoN feat pages across ${Object.keys(result.results).length} feat categories.`,
        );
        console.log(JSON.stringify(result.results, null, 2));
        exportUsableSnapshot(db);
        return;
      }
      const imported = await scrapeAonFeats(
        db,
        categoryArg,
        Number.isFinite(limit) ? limit : undefined,
      );
      console.log(`Scraped ${imported} AoN feat pages for ${categoryArg}.`);
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-races") {
      const categoryArg = process.argv[3];
      const limitArg =
        process.argv[4] ??
        (categoryArg === "all" ? process.argv[4] : undefined);
      const limit = limitArg ? Number(limitArg) : undefined;
      if (!categoryArg || categoryArg === "all") {
        const result = await scrapeAonRaceCatalog(db, {
          limitPerCategory: Number.isFinite(limit) ? limit : undefined,
        });
        console.log(
          `Scraped ${result.total} AoN race pages across ${Object.keys(result.results).length} race categories.`,
        );
        console.log(JSON.stringify(result.results, null, 2));
        exportUsableSnapshot(db);
        return;
      }
      const imported = await scrapeAonRaces(
        db,
        categoryArg,
        Number.isFinite(limit) ? limit : undefined,
      );
      console.log(`Scraped ${imported} AoN race pages for ${categoryArg}.`);
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-magic-item-urls") {
      const urls = process.argv.slice(3);
      if (urls.length === 0)
        throw new Error("Provide at least one AoN magic item URL.");
      const imported = await scrapeAonMagicItemUrls(db, urls);
      console.log(`Scraped ${imported} AoN magic item pages.`);
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-wondrous-items") {
      const result = await scrapeAonWondrousItems(db);
      console.log(
        `Scraped ${result.total} AoN wondrous item records across ${Object.keys(result.results).length} wondrous slots.`,
      );
      console.log(JSON.stringify(result.results, null, 2));
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-rings") {
      const result = await scrapeAonRings(db);
      console.log(
        `Scraped ${result.total} AoN ring records across ${Object.keys(result.results).length} ring pages.`,
      );
      console.log(JSON.stringify(result.results, null, 2));
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-rods") {
      const result = await scrapeAonRods(db);
      console.log(
        `Scraped ${result.total} AoN rod records across ${Object.keys(result.results).length} rod categories.`,
      );
      console.log(JSON.stringify(result.results, null, 2));
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-staves") {
      const result = await scrapeAonStaves(db);
      console.log(
        `Scraped ${result.total} AoN staff records across ${Object.keys(result.results).length} staff pages.`,
      );
      console.log(JSON.stringify(result.results, null, 2));
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-class-features") {
      const className = process.argv[3] ?? "Fighter";
      const imported = await scrapeAonClassFeatures(db, className);
      console.log(
        `Scraped ${imported} AoN class feature records for ${className}.`,
      );
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-base-class-features") {
      const result = await scrapeAonBaseClassFeatures(db);
      console.log(
        `Scraped ${result.total} AoN class feature records across ${Object.keys(result.results).length} base classes.`,
      );
      console.log(JSON.stringify(result.results, null, 2));
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-weapons") {
      const result = await scrapeAonWeapons(db);
      console.log(
        `Scraped ${result.total} AoN weapon records across ${Object.keys(result.results).length} weapon categories.`,
      );
      console.log(JSON.stringify(result.results, null, 2));
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-armor") {
      const result = await scrapeAonArmor(db);
      console.log(
        `Scraped ${result.total} AoN armor records across ${Object.keys(result.results).length} armor categories.`,
      );
      console.log(JSON.stringify(result.results, null, 2));
      exportUsableSnapshot(db);
      return;
    }
    if (command === "scrape-aon-gear") {
      const result = await scrapeAonGear(db);
      console.log(
        `Scraped ${result.total} AoN mundane gear records across ${Object.keys(result.results).length} misc equipment categories.`,
      );
      console.log(JSON.stringify(result.results, null, 2));
      exportUsableSnapshot(db);
      return;
    }
    throw new Error(`Unknown command: ${command ?? "<none>"}`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
