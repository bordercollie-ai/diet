import test from "node:test";
import assert from "node:assert/strict";
import {
  createFood,
  createMealEntry,
  createTemporaryMealEntry,
  createMemoryStore,
  bundledFoods,
  dailyTotals,
  deleteFood,
  deleteMealEntry,
  estimateTargets,
  estimateMaintenanceCalories,
  estimateBMR,
  previewBackup,
  roundForDisplay,
  resolveTargets,
  searchFoods,
  type AppData,
  updateFood,
  updateMealEntry,
  validateFood
} from "../src/domain/store.ts";

const food = (source: "bundled" | "user" = "user") => createFood({
  id: `${source}-1`,
  name: { en: source === "user" ? "Rice" : "Milk" },
  serving: "100 g",
  nutrition: { calories: 130, protein: 2.7, fat: 0.3, carbohydrates: 28 },
  source
});

const data: AppData = {
  foods: [food()],
  mealEntries: [{
    id: "meal-1",
    date: "2026-08-12",
    time: "08:00",
    foodId: "user-1",
    quantity: 2,
    nutrition: { calories: 260, protein: 5.4, fat: 0.6, carbohydrates: 56 }
  }]
};

test("loads and saves application data through the store interface", async () => {
  const store = createMemoryStore();
  await store.save(data);
  assert.deepEqual(await store.load(), data);
});

test("stable IDs and meal nutrition snapshots survive later food edits", () => {
  const entry = data.mealEntries[0];
  const updated = updateFood(data, "user-1", {
    name: { en: "Brown rice" },
    nutrition: { calories: 110, protein: 2.6, fat: 0.9, carbohydrates: 23 }
  });
  assert.equal(updated.foods[0].id, "user-1");
  assert.equal(updated.mealEntries[0].nutrition.calories, entry.nutrition.calories);
});

test("stamps updatedAt on creation and bumps it on every edit", () => {
  const created = createFood({
    name: { en: "Yogurt" },
    serving: "1 cup",
    nutrition: { calories: 100, protein: 10, fat: 2, carbohydrates: 8 },
    source: "user"
  });
  assert.equal(typeof created.updatedAt, "string");
  const olderUpdatedAt = "2020-01-01T00:00:00.000Z";
  const backdated = { foods: [{ ...created, updatedAt: olderUpdatedAt }], mealEntries: [] };
  const updated = updateFood(backdated, created.id, { serving: "2 cups" });
  assert.notEqual(updated.foods[0].updatedAt, olderUpdatedAt);
  assert.ok(new Date(updated.foods[0].updatedAt!).getTime() > new Date(olderUpdatedAt).getTime());
});

test("bundled foods cannot be edited or deleted", () => {
  const bundled = { ...data, foods: [food("bundled")] };
  assert.throws(() => updateFood(bundled, "bundled-1", { serving: "200 ml" }), /read-only/);
  assert.throws(() => deleteFood(bundled, "bundled-1"), /read-only/);
});

test("user foods can be deleted", () => {
  const next = deleteFood(data, "user-1");
  assert.deepEqual(next.foods, []);
  assert.equal(next.mealEntries[0].nutrition.calories, 260);
});

test("deleting a food preserves meal snapshots", async () => {
  const store = createMemoryStore(deleteFood(data, "user-1"));
  assert.deepEqual((await store.load()).mealEntries[0].nutrition, data.mealEntries[0].nutrition);
});

test("searches localized food names", () => {
  const foods = [
    food(),
    createFood({
      id: "brand-1",
      name: { ja: "おにぎり" },
      serving: "1 個",
      nutrition: { calories: 180, protein: 4, fat: 1, carbohydrates: 38 },
      source: "bundled"
    })
  ];
  assert.deepEqual(searchFoods(foods, "おにぎり").map((item) => item.id), ["brand-1"]);
  assert.equal(searchFoods(bundledFoods, "牛乳")[0].id, "bundled-milk");
});

test("searches foods by description (e.g. brand) and tolerates missing descriptions", () => {
  const foods = [
    food(),
    createFood({
      id: "branded-1",
      name: { en: "Big Mac" },
      description: "McDonald's Japan",
      serving: "1 serving",
      nutrition: { calories: 524, protein: 26.4, fat: 28, carbohydrates: 41.8 },
      source: "bundled"
    })
  ];
  assert.deepEqual(searchFoods(foods, "mcdonald").map((item) => item.id), ["branded-1"]);
  assert.deepEqual(searchFoods(foods, "big mac").map((item) => item.id), ["branded-1"]);
  // Foods without a description (e.g. legacy data saved before this field existed) still validate and search fine.
  assert.doesNotThrow(() => validateFood(food()));
  assert.deepEqual(searchFoods(foods, food().name.en ?? "").map((item) => item.id), [food().id]);
});

test("bundles McDonald's Japan foods with valid, unique, read-only records", () => {
  const mcdonalds = bundledFoods.filter((item) => item.id.startsWith("mcd-jp-"));
  assert.equal(mcdonalds.length, 202);

  const ids = new Set(mcdonalds.map((item) => item.id));
  assert.equal(ids.size, mcdonalds.length, "no duplicate McDonald's Japan food IDs");

  for (const item of mcdonalds) {
    assert.doesNotThrow(() => validateFood(item), `invalid McDonald's food: ${item.id}`);
    assert.equal(item.source, "bundled");
    assert.ok(item.name.ja?.trim(), `missing Japanese name: ${item.id}`);
    assert.ok(item.name.en?.trim(), `missing English name: ${item.id}`);
    assert.equal(item.description, "McDonald's Japan", `missing brand description: ${item.id}`);
    assert.throws(() => updateFood({ foods: [item], mealEntries: [] }, item.id, { serving: "2 servings" }), /read-only/);
  }
});

test("finds a McDonald's Japan food by its English or Japanese name", () => {
  const byEnglish = searchFoods(bundledFoods, "Big Mac");
  assert.ok(byEnglish.some((item) => item.id === "mcd-jp-1210"));
  assert.equal(byEnglish.find((item) => item.id === "mcd-jp-1210")?.nutrition.calories, 524);

  const byJapanese = searchFoods(bundledFoods, "ビッグマック");
  assert.ok(byJapanese.some((item) => item.id === "mcd-jp-1210"));

  // Both queries resolve to the same underlying bundled record.
  assert.deepEqual(
    byEnglish.find((item) => item.id === "mcd-jp-1210"),
    byJapanese.find((item) => item.id === "mcd-jp-1210")
  );

  // Searching by brand ("mcdonald") surfaces the same records via description.
  const byBrand = searchFoods(bundledFoods, "mcdonald");
  assert.ok(byBrand.some((item) => item.id === "mcd-jp-1210"));
});

test("creates, edits, deletes, and totals scaled meal entries by date", () => {
  const entry = createMealEntry({
    date: "2026-08-12",
    time: "12:00",
    foodId: "user-1",
    quantity: 0.5
  }, data.foods[0]);
  let next = { ...data, mealEntries: [entry] };
  assert.equal(dailyTotals(next, "2026-08-12").calories, 65);
  assert.equal(dailyTotals(next, "2026-08-13").calories, 0);
  next = updateMealEntry(next, entry.id, { quantity: 2, time: "13:00" });
  assert.equal(next.mealEntries[0].nutrition.calories, 260);
  assert.equal(next.mealEntries[0].time, "13:00");
  assert.deepEqual(deleteMealEntry(next, entry.id).mealEntries, []);
});

test("rounds calculated float artifacts for display without changing decimal input support", () => {
  assert.equal(roundForDisplay(94.1999999999999), 94);
  assert.equal(roundForDisplay(94.6), 95);
  assert.equal(roundForDisplay(94.2), 94);
});

test("scales a decimal quantity and rounds only the displayed result", () => {
  const item = createFood({
    name: { en: "45 kcal snack" },
    serving: "1 piece",
    nutrition: { calories: 45, protein: 1.3, fat: 0.7, carbohydrates: 8.2 },
    source: "user"
  });

  const entry = createMealEntry({
    date: "2026-08-12",
    time: "18:00",
    foodId: item.id,
    quantity: 1.3
  }, item);

  assert.equal(entry.nutrition.calories, 58.5);
  assert.equal(dailyTotals({ foods: [item], mealEntries: [entry] }, "2026-08-12").calories, 58.5);
  assert.equal(roundForDisplay(entry.nutrition.calories), 59);
});

test("records temporary calories without creating a food", () => {
  const entry = createTemporaryMealEntry({
    date: "2026-08-12",
    time: "20:00",
    quantity: 1,
    foodName: "Untracked dessert",
    nutrition: { calories: 250, protein: 10, fat: 5, carbohydrates: 30 }
  });
  assert.equal(entry.foodId, "");
  assert.equal(entry.foodName, "Untracked dessert");
  assert.equal(entry.nutrition.calories, 250);
  assert.equal(entry.nutrition.protein, 10);
  assert.deepEqual(dailyTotals({ foods: [], mealEntries: [entry] }, "2026-08-12").calories, 250);
});

test("invalid food and quantity data is rejected", async () => {
  assert.throws(() => createFood({
    name: { en: "Bad" },
    serving: "100 g",
    nutrition: { calories: -1, protein: 0, fat: 0, carbohydrates: 0 },
    source: "user"
  }), /Invalid data/);

  const store = createMemoryStore();
  await assert.rejects(store.save({ ...data, mealEntries: [{ ...data.mealEntries[0], quantity: 0 }] }), /Invalid data/);
});

test("estimates deterministic targets and restores estimates after override removal", () => {
  const profile = { age: 30, sex: "male" as const, heightCm: 180, weightKg: 80, activity: "moderate" as const, targetWeightKg: 70, targetDate: "2027-01-01" };
  const estimated = estimateTargets(profile, "2026-08-12");
  assert.ok(estimateMaintenanceCalories(profile) > estimated.calories);
  assert.equal(estimateBMR(profile), 1780);
  assert.equal(estimateMaintenanceCalories({ ...profile, activity: "bmrOnly" }), estimateBMR(profile));
  assert.ok(estimateTargets({ ...profile, targetDate: "2026-09-12" }, "2026-08-12").calories >
    estimateTargets({ ...profile, targetDate: "2026-08-19" }, "2026-08-12").calories);
  assert.deepEqual(estimateTargets(profile, "2026-08-12"), estimated);
  assert.equal(resolveTargets(profile, { calories: 2000 }, "2026-08-12").calories, 2000);
  assert.equal(resolveTargets(profile, {}, "2026-08-12").calories, estimated.calories);
  assert.throws(() => estimateTargets({ ...profile, weightKg: 0 }), /Invalid data/);
  assert.throws(() => estimateTargets({ ...profile, targetDate: "2026-08-12" }, "2026-08-12"), /target date/);
});

test("exports and imports a valid backup without changing supported data", async () => {
  const source = createMemoryStore(data);
  const target = createMemoryStore();
  await target.import(await source.export());
  assert.deepEqual(await target.load(), data);
});

test("rejects invalid backups without mutating existing data", async () => {
  const store = createMemoryStore(data);
  await assert.rejects(store.import('{"schemaVersion": 99}'), /Invalid backup/);
  assert.deepEqual(await store.load(), data);
});

test("previews valid backups and rejects unsupported versions before import", async () => {
  const backup = await createMemoryStore(data).export();
  assert.deepEqual(previewBackup(backup).data, data);
  assert.throws(() => previewBackup('{"schemaVersion": 99}'), /Unsupported backup version/);
});

test("imports by ID, replacing matches and preserving unrelated records", async () => {
  const extraFood = createFood({
    id: "extra-food",
    name: { en: "Apple" },
    serving: "1 piece",
    nutrition: { calories: 80, protein: 0, fat: 0, carbohydrates: 21 },
    source: "user"
  });
  const extraMeal = createMealEntry({
    id: "extra-meal",
    date: "2026-08-12",
    time: "09:00",
    foodId: extraFood.id,
    quantity: 1
  }, extraFood);
  const target = createMemoryStore({
    ...data,
    foods: [...data.foods, extraFood],
    mealEntries: [...data.mealEntries, extraMeal]
  });
  const source = createMemoryStore({
    ...data,
    foods: [createFood({ ...data.foods[0], name: { en: "Brown rice" } })],
    mealEntries: [createMealEntry({
      ...data.mealEntries[0],
      quantity: 3
    }, data.foods[0])]
  });

  await target.import(await source.export());
  const imported = await target.load();
  assert.equal(imported.foods.find((item) => item.id === "user-1")?.name.en, "Brown rice");
  assert.equal(imported.mealEntries.find((item) => item.id === "meal-1")?.quantity, 3);
  assert.ok(imported.foods.some((item) => item.id === "extra-food"));
  assert.ok(imported.mealEntries.some((item) => item.id === "extra-meal"));
});
