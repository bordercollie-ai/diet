import test from "node:test";
import assert from "node:assert/strict";
import {
  createFood,
  createMealEntry,
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
  updateMealEntry
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
