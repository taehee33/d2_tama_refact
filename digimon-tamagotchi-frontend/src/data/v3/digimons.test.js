import fs from "fs";
import path from "path";
import { adaptDataMapToOldFormat } from "../v1/adapter";
import { digimonDataVer3, V3_SPRITE_BASE } from "./digimons";
import {
  getDeathFormIds,
  getDigimonDataMapByVersion,
  getSpriteBasePathByVersion,
  getStarterDigimonId,
  SUPPORTED_DIGIMON_VERSIONS,
} from "../../utils/digimonVersionUtils";

const REQUIRED_ENTRY_FIELDS = [
  "id",
  "name",
  "stage",
  "sprite",
  "spriteBasePath",
  "stats",
  "evolutionCriteria",
  "evolutions",
];

const REQUIRED_STATS_FIELDS = [
  "hungerCycle",
  "strengthCycle",
  "poopCycle",
  "maxOverfeed",
  "basePower",
  "maxEnergy",
  "minWeight",
  "healDoses",
  "type",
  "sleepTime",
  "attackSprite",
];

const SUPPORTED_CONDITION_KEYS = new Set([
  "careMistakes",
  "trainings",
  "overfeeds",
  "sleepDisturbances",
  "battles",
  "winRatio",
  "weight",
  "strength",
  "power",
]);

const findEntryAcrossVersions = (digimonId, preferredVersion = "Ver.3") => {
  const versions = [
    preferredVersion,
    ...SUPPORTED_DIGIMON_VERSIONS.filter((version) => version !== preferredVersion),
  ];

  for (const version of versions) {
    const entry = getDigimonDataMapByVersion(version)?.[digimonId];
    if (entry) {
      return { version, entry };
    }
  }

  return null;
};

const collectConditions = (evolution) => {
  if (evolution.conditions) {
    return [evolution.conditions];
  }

  if (Array.isArray(evolution.conditionGroups)) {
    return evolution.conditionGroups;
  }

  return [];
};

describe("digimonDataVer3", () => {
  test("key, id, required fields, and spriteBasePath are consistent", () => {
    const ids = new Set();
    const sprites = new Set();

    Object.entries(digimonDataVer3).forEach(([key, entry]) => {
      expect(entry.id).toBe(key);
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);

      REQUIRED_ENTRY_FIELDS.forEach((field) => {
        expect(entry).toHaveProperty(field);
      });

      expect(entry.spriteBasePath).toBe(V3_SPRITE_BASE);
      expect(typeof entry.sprite).toBe("number");
      expect(sprites.has(entry.sprite)).toBe(false);
      sprites.add(entry.sprite);

      REQUIRED_STATS_FIELDS.forEach((field) => {
        expect(entry.stats).toHaveProperty(field);
      });
    });
  });

  test("configured starter and death forms exist", () => {
    expect(getStarterDigimonId("Ver.3")).toBe("DigitamaV3");
    expect(digimonDataVer3[getStarterDigimonId("Ver.3")]).toBeTruthy();

    expect(getDeathFormIds("Ver.3")).toEqual(["Ohakadamon1V3", "Ohakadamon2V3"]);
    getDeathFormIds("Ver.3").forEach((deathFormId) => {
      expect(digimonDataVer3[deathFormId]).toBeTruthy();
    });
  });

  test("all referenced sprites exist in public/Ver3_Mod_TH", () => {
    const assetDir = path.resolve(process.cwd(), "public", "Ver3_Mod_TH");
    const assetFiles = new Set(fs.readdirSync(assetDir));

    Object.values(digimonDataVer3).forEach((entry) => {
      expect(assetFiles.has(`${entry.sprite}.png`)).toBe(true);
    });
  });

  test("all public Ver.3 sprites are referenced by data", () => {
    const assetDir = path.resolve(process.cwd(), "public", "Ver3_Mod_TH");
    const assetSprites = fs
      .readdirSync(assetDir)
      .filter((fileName) => fileName.endsWith(".png"))
      .map((fileName) => Number.parseInt(path.basename(fileName, ".png"), 10))
      .sort((a, b) => a - b);
    const dataSprites = Object.values(digimonDataVer3)
      .map((entry) => entry.sprite)
      .sort((a, b) => a - b);

    expect(dataSprites).toEqual(assetSprites);
  });

  test("evolution targets, names, conditions, and jogress partners are valid", () => {
    Object.values(digimonDataVer3).forEach((entry) => {
      entry.evolutions.forEach((evolution) => {
        const target = findEntryAcrossVersions(evolution.targetId, "Ver.3");
        expect(target).toBeTruthy();
        expect(evolution.targetName).toBe(target.entry.name);

        collectConditions(evolution).forEach((conditions) => {
          Object.keys(conditions).forEach((conditionKey) => {
            expect(SUPPORTED_CONDITION_KEYS.has(conditionKey)).toBe(true);
          });
        });

        if (evolution.jogress) {
          expect(SUPPORTED_DIGIMON_VERSIONS).toContain(evolution.jogress.partnerVersion);
          const partner = findEntryAcrossVersions(
            evolution.jogress.partner,
            evolution.jogress.partnerVersion
          );
          expect(partner).toBeTruthy();
          expect(partner.version).toBe(evolution.jogress.partnerVersion);
          expect(evolution.jogress.partnerName).toBe(partner.entry.name);
        }
      });
    });
  });

  test("adapter produces legacy runtime fields without duplicating them in source data", () => {
    const adapted = adaptDataMapToOldFormat(digimonDataVer3);

    Object.entries(digimonDataVer3).forEach(([id, entry]) => {
      expect(entry.hungerTimer).toBeUndefined();
      expect(entry.strengthTimer).toBeUndefined();
      expect(entry.maxStamina).toBeUndefined();

      expect(adapted[id]).toMatchObject({
        evolutionStage: entry.stage,
        timeToEvolveSeconds: entry.evolutionCriteria?.timeToEvolveSeconds || 0,
        hungerTimer: entry.stats.hungerCycle,
        strengthTimer: entry.stats.strengthCycle,
        poopTimer: entry.stats.poopCycle,
        maxEnergy: entry.stats.maxEnergy,
        maxStamina: entry.stats.maxEnergy,
        basePower: entry.stats.basePower,
        attackSprite: entry.stats.attackSprite ?? entry.sprite,
        spriteBasePath: getSpriteBasePathByVersion("Ver.3"),
      });
    });
  });
});
