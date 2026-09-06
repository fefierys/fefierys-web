import { equal, ok } from "node:assert/strict";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  const {
    normalizeCommissionPricingSnapshot,
    resolveActiveCommissionPricingSnapshot,
  } =
    await import("../lib/repositories/commissionPricingSnapshotMatcherRepository");

  equal(normalizeCommissionPricingSnapshot(" Semi-Realism "), "semirealism");
  equal(
    normalizeCommissionPricingSnapshot("Chibis & Emotes"),
    "chibisandemotes",
  );
  equal(
    normalizeCommissionPricingSnapshot("Structures & Interiors"),
    "structuresandinteriors",
  );
  console.log("[OK] Portfolio snapshot values are normalized consistently");

  const fullWrap = await resolveActiveCommissionPricingSnapshot({
    category: "COVERS",
    collection: "BOOK ART",
    option: "Full Wrap",
    style: "SEMIREALISM",
  });
  equal(fullWrap.outcome, "matched");
  if (fullWrap.outcome !== "matched") {
    throw new Error("Semi-realism Full Wrap did not resolve");
  }
  equal(fullWrap.service.code, "semi-covers");
  equal(fullWrap.option.code, "full-wrap");
  console.log("[OK] Semi-realism Book Covers resolves uniquely");

  const environment = await resolveActiveCommissionPricingSnapshot({
    category: "ENVIRONMENTS",
    collection: "GENERAL",
    option: "Natural Landscape",
    style: "SEMIREALISM",
  });
  equal(environment.outcome, "matched");
  if (environment.outcome !== "matched") {
    throw new Error("Semi-realism Natural Landscape did not resolve");
  }
  equal(environment.service.code, "semi-environments");
  equal(environment.option.code, "natural-landscape");
  console.log("[OK] Semi-realism Environments resolves uniquely");

  const stylizedIcon = await resolveActiveCommissionPricingSnapshot({
    category: "ICONS",
    collection: "GENERAL",
    option: "Circular Frame",
    style: "STYLIZED",
  });
  equal(stylizedIcon.outcome, "matched");
  if (stylizedIcon.outcome !== "matched") {
    throw new Error("Stylized Circular Frame did not resolve");
  }
  equal(stylizedIcon.service.code, "sty-icons");
  equal(stylizedIcon.option.code, "circular-frame");
  console.log("[OK] Repeated service names use their complete portfolio path");

  const incomplete = await resolveActiveCommissionPricingSnapshot({
    category: "Not specified",
    collection: "Not specified",
    option: "Not specified",
    style: "Not specified",
  });
  equal(incomplete.outcome, "incomplete");
  console.log("[OK] Direct contact snapshots remain unclassified");

  const missing = await resolveActiveCommissionPricingSnapshot({
    category: "ENVIRONMENTS",
    collection: "GENERAL",
    option: "Unknown Option",
    style: "SEMIREALISM",
  });
  equal(missing.outcome, "no_match");
  console.log("[OK] Unknown portfolio options do not produce a false match");

  ok(fullWrap.version.id);
  console.log("[OK] Commission pricing snapshot matcher verification passed");
}

main().catch((error: unknown) => {
  console.error(
    "Commission pricing snapshot matcher verification failed:",
    error,
  );
  process.exitCode = 1;
});
