import test from 'node:test'
import assert from 'node:assert/strict'
import {
  achievementDefinitions,
  calorieTone,
  createFood,
  createMealEntry,
  createTemporaryMealEntry,
  createMemoryStore,
  bundledFoods,
  calorieTargetForDate,
  dailyTotals,
  deleteFood,
  deleteMealEntry,
  estimateTargets,
  exerciseCaloriesForDate,
  evaluateAchievements,
  estimateMaintenanceCalories,
  estimateBMR,
  markAchievementsRead,
  prepareAppData,
  previewBackup,
  roundForDisplay,
  resolveDarkMode,
  resolveTargets,
  searchFoods,
  setTargetPeriod,
  setExerciseCalories,
  targetsForDate,
  toggleFavoriteFood,
  type AppData,
  updateFood,
  updateMealEntry,
  validateFood,
} from '../src/domain/store.ts'

const fixedNow = '2026-08-18T04:49:42.173Z'
const fixedToday = fixedNow.slice(0, 10)

const food = (source: 'bundled' | 'user' = 'user') =>
  createFood({
    id: `${source}-1`,
    name: { en: source === 'user' ? 'Rice' : 'Milk' },
    serving: '100 g',
    nutrition: { calories: 130, protein: 2.7, fat: 0.3, carbohydrates: 28 },
    source,
  })

const data: AppData = {
  foods: [food()],
  mealEntries: [
    {
      id: 'meal-1',
      date: '2026-08-12',
      time: '08:00',
      foodId: 'user-1',
      quantity: 2,
      nutrition: { calories: 260, protein: 5.4, fat: 0.6, carbohydrates: 56 },
    },
  ],
}

const withoutAchievements = (value: AppData): Omit<AppData, 'achievements'> => {
  const { achievements: _achievements, ...rest } = value
  return rest
}

const baseProfile = {
  age: 30,
  sex: 'female' as const,
  heightCm: 165,
  weightKg: 60,
  activity: 'moderate' as const,
  targetWeightKg: 58,
  targetDate: '2026-12-31',
}

const identifiedFood = (id = 'identified-food', name = id) =>
  createFood({
    id,
    name: { en: name },
    serving: '1 serving',
    nutrition: { calories: 2000, protein: 20, fat: 10, carbohydrates: 250 },
    source: 'user',
    updatedAt: fixedNow,
  })

const identifiedEntry = (index: number, date: string, foodId = 'identified-food') => ({
  id: `meal-${foodId}-${index}`,
  date,
  time: '12:00',
  foodId,
  quantity: 1,
  nutrition: { calories: 2000, protein: 20, fat: 10, carbohydrates: 250 },
})

const temporaryEntry = (index: number, date: string) =>
  createTemporaryMealEntry({
    id: `temporary-${index}`,
    date,
    time: '12:00',
    quantity: 1,
    foodName: `Quick ${index}`,
    nutrition: { calories: 250, protein: 10, fat: 5, carbohydrates: 30 },
  })

const daySeries = (days: number, start = '2026-08-01') =>
  Array.from({ length: days }, (_, index) => {
    const day = new Date(`${start}T12:00:00Z`)
    day.setUTCDate(day.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })

test('loads and saves application data through the store interface', async () => {
  const store = createMemoryStore()
  await store.save(data)
  assert.deepEqual(withoutAchievements(await store.load()), data)
})

test('stable IDs and meal nutrition snapshots survive later food edits', () => {
  const entry = data.mealEntries[0]
  const updated = updateFood(data, 'user-1', {
    name: { en: 'Brown rice' },
    nutrition: { calories: 110, protein: 2.6, fat: 0.9, carbohydrates: 23 },
  })
  assert.equal(updated.foods[0].id, 'user-1')
  assert.equal(updated.mealEntries[0].nutrition.calories, entry.nutrition.calories)
})

test('stamps updatedAt on creation and bumps it on every edit', () => {
  const created = createFood({
    name: { en: 'Yogurt' },
    serving: '1 cup',
    nutrition: { calories: 100, protein: 10, fat: 2, carbohydrates: 8 },
    source: 'user',
  })
  assert.equal(typeof created.updatedAt, 'string')
  const olderUpdatedAt = '2020-01-01T00:00:00.000Z'
  const backdated = { foods: [{ ...created, updatedAt: olderUpdatedAt }], mealEntries: [] }
  const updated = updateFood(backdated, created.id, { serving: '2 cups' })
  assert.notEqual(updated.foods[0].updatedAt, olderUpdatedAt)
  assert.ok(new Date(updated.foods[0].updatedAt!).getTime() > new Date(olderUpdatedAt).getTime())
})

test('bundled foods cannot be edited or deleted', () => {
  const bundled = { ...data, foods: [food('bundled')] }
  assert.throws(() => updateFood(bundled, 'bundled-1', { serving: '200 ml' }), /read-only/)
  assert.throws(() => deleteFood(bundled, 'bundled-1'), /read-only/)
})

test('user foods can be deleted', () => {
  const next = deleteFood(data, 'user-1')
  assert.deepEqual(next.foods, [])
  assert.equal(next.mealEntries[0].nutrition.calories, 260)
})

test('deleting a food preserves meal snapshots', async () => {
  const store = createMemoryStore(deleteFood(data, 'user-1'))
  assert.deepEqual((await store.load()).mealEntries[0].nutrition, data.mealEntries[0].nutrition)
})

test('toggles a food as favorite and lists favorites first in search results', () => {
  const foods = [
    createFood({
      id: 'a',
      name: { en: 'Apple' },
      serving: '1',
      nutrition: { calories: 95, protein: 0.5, fat: 0.3, carbohydrates: 25 },
      source: 'user',
    }),
    createFood({
      id: 'b',
      name: { en: 'Apple Pie' },
      serving: '1',
      nutrition: { calories: 300, protein: 3, fat: 14, carbohydrates: 42 },
      source: 'user',
    }),
  ]
  let data: AppData = { foods, mealEntries: [] }

  assert.deepEqual(
    searchFoods(data.foods, 'apple', data.favoriteFoodIds).map((item) => item.id),
    ['a', 'b'],
  )

  data = toggleFavoriteFood(data, 'b')
  assert.deepEqual(data.favoriteFoodIds, ['b'])
  assert.deepEqual(
    searchFoods(data.foods, 'apple', data.favoriteFoodIds).map((item) => item.id),
    ['b', 'a'],
  )

  data = toggleFavoriteFood(data, 'b')
  assert.deepEqual(data.favoriteFoodIds, [])
  assert.throws(() => toggleFavoriteFood(data, 'missing'), /not found/)
})

test('sorts the full (no-query) list alphabetically by name with favorites pinned first', () => {
  // Inserted in an order that would bury 'custom-1' behind hundreds of bundled
  // foods if the list were left in insertion order instead of name-sorted.
  const bundledZebra = createFood({
    id: 'bundled-1',
    name: { en: 'Zebra Cake' },
    serving: '1',
    nutrition: { calories: 95, protein: 0.5, fat: 0.3, carbohydrates: 25 },
    source: 'bundled',
  })
  const custom = createFood({
    id: 'custom-1',
    name: { en: 'My Rice' },
    serving: '1',
    nutrition: { calories: 95, protein: 0.5, fat: 0.3, carbohydrates: 25 },
    source: 'user',
  })
  const bundledApple = createFood({
    id: 'bundled-2',
    name: { en: 'Apple' },
    serving: '1',
    nutrition: { calories: 95, protein: 0.5, fat: 0.3, carbohydrates: 25 },
    source: 'bundled',
  })
  const foods = [bundledZebra, custom, bundledApple]

  assert.deepEqual(
    searchFoods(foods, '', []).map((item) => item.id),
    ['bundled-2', 'custom-1', 'bundled-1'],
  )

  // Favoriting the alphabetically-last item still pins it to the top, ahead
  // of every non-favorite regardless of name or source.
  assert.deepEqual(
    searchFoods(foods, '', ['bundled-1']).map((item) => item.id),
    ['bundled-1', 'bundled-2', 'custom-1'],
  )
})

test('searches localized food names', () => {
  const foods = [
    food(),
    createFood({
      id: 'brand-1',
      name: { ja: 'おにぎり' },
      serving: '1 個',
      nutrition: { calories: 180, protein: 4, fat: 1, carbohydrates: 38 },
      source: 'bundled',
    }),
  ]
  assert.deepEqual(
    searchFoods(foods, 'おにぎり').map((item) => item.id),
    ['brand-1'],
  )
  assert.equal(searchFoods(bundledFoods, '牛乳')[0].id, 'bundled-milk')
})

test('searches foods by description (e.g. brand) and tolerates missing descriptions', () => {
  const foods = [
    food(),
    createFood({
      id: 'branded-1',
      name: { en: 'Big Mac' },
      description: "McDonald's Japan",
      serving: '1 serving',
      nutrition: { calories: 524, protein: 26.4, fat: 28, carbohydrates: 41.8 },
      source: 'bundled',
    }),
  ]
  assert.deepEqual(
    searchFoods(foods, 'mcdonald').map((item) => item.id),
    ['branded-1'],
  )
  assert.deepEqual(
    searchFoods(foods, 'big mac').map((item) => item.id),
    ['branded-1'],
  )
  // Foods without a description (e.g. legacy data saved before this field existed) still validate and search fine.
  assert.doesNotThrow(() => validateFood(food()))
  assert.deepEqual(
    searchFoods(foods, food().name.en ?? '').map((item) => item.id),
    [food().id],
  )
})

test('fuzzy-matches out-of-order keywords across a name (e.g. "abc ghj" finds "abc def ghj")', () => {
  const foods = [
    food(),
    createFood({
      id: 'multi-word-1',
      name: { en: 'Low-fat high-protein milk' },
      serving: '200 ml',
      nutrition: { calories: 104, protein: 10.3, fat: 0.3, carbohydrates: 15.1 },
      source: 'bundled',
    }),
  ]
  // Tokens found anywhere, any order — not just as one contiguous substring.
  assert.deepEqual(
    searchFoods(foods, 'protein low').map((item) => item.id),
    ['multi-word-1'],
  )
  // A missing token means no match.
  assert.deepEqual(
    searchFoods(foods, 'protein nonexistent').map((item) => item.id),
    [],
  )
})

test('fuzzy-matches CJK keywords with no spaces between them (e.g. "低脂牛乳" finds "森永低脂高たんぱく牛乳")', () => {
  assert.deepEqual(
    searchFoods(bundledFoods, '低脂牛乳').map((item) => item.id),
    ['bundled-milk-low-fat-high-protein'],
  )
})

test("bundles McDonald's Japan foods with valid, unique, read-only records", () => {
  const mcdonalds = bundledFoods.filter((item) => item.id.startsWith('mcd-jp-'))
  assert.equal(mcdonalds.length, 202)

  const ids = new Set(mcdonalds.map((item) => item.id))
  assert.equal(ids.size, mcdonalds.length, "no duplicate McDonald's Japan food IDs")

  for (const item of mcdonalds) {
    assert.doesNotThrow(() => validateFood(item), `invalid McDonald's food: ${item.id}`)
    assert.equal(item.source, 'bundled')
    assert.ok(item.name.ja?.trim(), `missing Japanese name: ${item.id}`)
    assert.ok(item.name.en?.trim(), `missing English name: ${item.id}`)
    assert.equal(item.description, "McDonald's Japan", `missing brand description: ${item.id}`)
    assert.throws(() => updateFood({ foods: [item], mealEntries: [] }, item.id, { serving: '2 servings' }), /read-only/)
  }
})

test('bundles audited Kanto convenience-store counter foods', () => {
  const counterFoodIds = [
    'seven-jp-nana-chiki',
    'seven-jp-karaage-stick',
    'seven-jp-charcoal-grilled-chicken-salt',
    'seven-jp-spice-chicken',
    'lawson-jp-karaage-kun-regular',
    'lawson-jp-l-chiki-red',
    'lawson-jp-marumaru-dori',
    'familymart-jp-famichiki',
    'familymart-jp-famichiki-red',
    'familymart-jp-spicy-chicken',
    'familymart-jp-crispy-chicken-plain',
  ]
  const convenienceStoreCounterFoods = bundledFoods.filter((item) => counterFoodIds.includes(item.id))
  assert.equal(convenienceStoreCounterFoods.length, counterFoodIds.length)
  assert.equal(new Set(convenienceStoreCounterFoods.map((item) => item.id)).size, counterFoodIds.length)

  const expectedNutrition = {
    'seven-jp-nana-chiki': { calories: 174, protein: 13.4, fat: 9, carbohydrates: 10 },
    'seven-jp-karaage-stick': { calories: 200, protein: 7.7, fat: 11.6, carbohydrates: 16.6 },
    'seven-jp-charcoal-grilled-chicken-salt': { calories: 66, protein: 9.6, fat: 3, carbohydrates: 0.3 },
    'seven-jp-spice-chicken': { calories: 200, protein: 14.2, fat: 11, carbohydrates: 11.2 },
    'lawson-jp-karaage-kun-regular': { calories: 226, protein: 14.4, fat: 15.4, carbohydrates: 7.8 },
    'lawson-jp-l-chiki-red': { calories: 247, protein: 12.4, fat: 16.4, carbohydrates: 12.7 },
    'lawson-jp-marumaru-dori': { calories: 207, protein: 17.4, fat: 12.3, carbohydrates: 6.9 },
    'familymart-jp-famichiki': { calories: 251.7, protein: 12.7, fat: 15.7, carbohydrates: 14.8 },
    'familymart-jp-famichiki-red': { calories: 253.4, protein: 14.9, fat: 14.7, carbohydrates: 15.5 },
    'familymart-jp-spicy-chicken': { calories: 207, protein: 9.5, fat: 12.2, carbohydrates: 14.7 },
    'familymart-jp-crispy-chicken-plain': { calories: 183.1, protein: 12.2, fat: 9.6, carbohydrates: 11.9 },
  }
  for (const item of convenienceStoreCounterFoods) {
    assert.doesNotThrow(() => validateFood(item), `invalid convenience-store food: ${item.id}`)
    assert.equal(item.source, 'bundled')
    assert.ok(item.name.ja?.trim(), `missing Japanese name: ${item.id}`)
    assert.ok(item.description?.trim(), `missing brand description: ${item.id}`)
    assert.doesNotMatch(item.name.ja!, /\u3000/, `full-width space in name: ${item.id}`)
    if (item.id.startsWith('seven-jp-')) assert.match(item.name.ja!, /^711 /, `missing 711 name prefix: ${item.id}`)
    assert.deepEqual(item.nutrition, expectedNutrition[item.id as keyof typeof expectedNutrition])
  }

  assert.deepEqual(
    searchFoods(bundledFoods, 'ななチキ').map((item) => item.id),
    ['seven-jp-nana-chiki'],
  )
  assert.ok(searchFoods(bundledFoods, 'lawson').some((item) => item.id === 'lawson-jp-l-chiki-red'))
  assert.ok(searchFoods(bundledFoods, 'FamilyMart').some((item) => item.id === 'familymart-jp-famichiki-red'))
})

test('bundles unique audited Tokyo and Kanagawa 7-Eleven sandwiches', () => {
  const sandwiches = bundledFoods.filter((item) => item.id.startsWith('seven-jp-kanto-sandwich-'))
  assert.equal(sandwiches.length, 17)
  assert.equal(new Set(sandwiches.map((item) => item.id)).size, sandwiches.length)
  assert.equal(new Set(sandwiches.map((item) => item.name.ja)).size, sandwiches.length)

  for (const item of sandwiches) {
    assert.doesNotThrow(() => validateFood(item), `invalid 7-Eleven sandwich: ${item.id}`)
    assert.equal(item.source, 'bundled')
    assert.equal(item.description, '711 Japan')
    assert.ok(item.name.ja?.trim(), `missing Japanese name: ${item.id}`)
    assert.doesNotMatch(item.name.ja!, /\u3000/, `full-width space in name: ${item.id}`)
    assert.match(item.name.ja!, /^711 /, `missing 711 name prefix: ${item.id}`)
  }

  assert.deepEqual(
    searchFoods(bundledFoods, 'ブリトーチーズ倍盛り ハム＆チーズ').map((item) => item.id),
    ['seven-jp-kanto-sandwich-053793'],
  )
})

test('bundles the official 7-Eleven chicken and chili roll', () => {
  const roll = bundledFoods.find((item) => item.id === 'seven-jp-053705')
  assert.ok(roll)
  assert.doesNotThrow(() => validateFood(roll))
  assert.equal(roll.description, '711 Japan')
  assert.deepEqual(roll.nutrition, { calories: 261, protein: 24.1, fat: 8.8, carbohydrates: 23.3 })
  assert.deepEqual(roll.detail, { sugar: 19.3, fiber: 4, salt: 2.1 })
  assert.deepEqual(searchFoods(bundledFoods, 'たんぱく質が摂れるチキン＆チリ').map((item) => item.id), ['seven-jp-053705'])
})

test("finds a McDonald's Japan food by its English or Japanese name", () => {
  const byEnglish = searchFoods(bundledFoods, 'Big Mac')
  assert.ok(byEnglish.some((item) => item.id === 'mcd-jp-1210'))
  assert.equal(byEnglish.find((item) => item.id === 'mcd-jp-1210')?.nutrition.calories, 524)

  const byJapanese = searchFoods(bundledFoods, 'ビッグマック')
  assert.ok(byJapanese.some((item) => item.id === 'mcd-jp-1210'))

  // Both queries resolve to the same underlying bundled record.
  assert.deepEqual(
    byEnglish.find((item) => item.id === 'mcd-jp-1210'),
    byJapanese.find((item) => item.id === 'mcd-jp-1210'),
  )

  // Searching by brand ("mcdonald") surfaces the same records via description.
  const byBrand = searchFoods(bundledFoods, 'mcdonald')
  assert.ok(byBrand.some((item) => item.id === 'mcd-jp-1210'))
})

test('bundles Starbucks Japan foods with valid, unique, read-only records', () => {
  const starbucks = bundledFoods.filter((item) => item.id.startsWith('sbux-jp-'))
  assert.equal(starbucks.length, 16)

  const ids = new Set(starbucks.map((item) => item.id))
  assert.equal(ids.size, starbucks.length, 'no duplicate Starbucks Japan food IDs')

  for (const item of starbucks) {
    assert.doesNotThrow(() => validateFood(item), `invalid Starbucks food: ${item.id}`)
    assert.equal(item.source, 'bundled')
    assert.ok(item.name.ja?.trim(), `missing Japanese name: ${item.id}`)
    assert.ok(item.name.en?.trim(), `missing English name: ${item.id}`)
    assert.equal(item.description, 'Starbucks Japan', `missing brand description: ${item.id}`)
    assert.ok(/^(Short|Tall|Grande|Venti), (Hot|Ice)$/.test(item.serving), `unexpected serving format: ${item.id}`)
    assert.throws(() => updateFood({ foods: [item], mealEntries: [] }, item.id, { serving: 'Tall, Hot' }), /read-only/)
  }
})

test('finds a Starbucks Japan drink by its English or Japanese name across sizes', () => {
  const byEnglish = searchFoods(bundledFoods, 'Starbucks Latte')
  const sizes = byEnglish.filter((item) => item.id.startsWith('sbux-jp-4524785000223-'))
  assert.equal(sizes.length, 4, 'expected all four Ice sizes of the Starbucks Latte')
  assert.equal(sizes.find((item) => item.serving === 'Grande, Ice')?.nutrition.calories, 169)
  // Names embed the size/temperature so distinct sizes remain distinguishable wherever the name alone is shown.
  assert.ok(sizes.every((item) => item.name.en?.includes(item.serving)))

  const byJapanese = searchFoods(bundledFoods, 'スターバックス ラテ')
  assert.equal(byJapanese.filter((item) => item.id.startsWith('sbux-jp-4524785000223-')).length, 4)
})

test('creates, edits, deletes, and totals scaled meal entries by date', () => {
  const entry = createMealEntry(
    {
      date: '2026-08-12',
      time: '12:00',
      foodId: 'user-1',
      quantity: 0.5,
    },
    data.foods[0],
  )
  let next = { ...data, mealEntries: [entry] }
  assert.equal(dailyTotals(next, '2026-08-12').calories, 65)
  assert.equal(dailyTotals(next, '2026-08-13').calories, 0)
  next = updateMealEntry(next, entry.id, { quantity: 2, time: '13:00' })
  assert.equal(next.mealEntries[0].nutrition.calories, 260)
  assert.equal(next.mealEntries[0].time, '13:00')
  assert.deepEqual(deleteMealEntry(next, entry.id).mealEntries, [])
})

test('rounds calculated float artifacts for display without changing decimal input support', () => {
  assert.equal(roundForDisplay(94.1999999999999), 94)
  assert.equal(roundForDisplay(94.6), 95)
  assert.equal(roundForDisplay(94.2), 94)
})

test('scales a decimal quantity and rounds only the displayed result', () => {
  const item = createFood({
    name: { en: '45 kcal snack' },
    serving: '1 piece',
    nutrition: { calories: 45, protein: 1.3, fat: 0.7, carbohydrates: 8.2 },
    source: 'user',
  })

  const entry = createMealEntry(
    {
      date: '2026-08-12',
      time: '18:00',
      foodId: item.id,
      quantity: 1.3,
    },
    item,
  )

  assert.equal(entry.nutrition.calories, 58.5)
  assert.equal(dailyTotals({ foods: [item], mealEntries: [entry] }, '2026-08-12').calories, 58.5)
  assert.equal(roundForDisplay(entry.nutrition.calories), 59)
})

test('records temporary calories without creating a food', () => {
  const entry = createTemporaryMealEntry({
    date: '2026-08-12',
    time: '20:00',
    quantity: 1,
    foodName: 'Untracked dessert',
    nutrition: { calories: 250, protein: 10, fat: 5, carbohydrates: 30 },
  })
  assert.equal(entry.foodId, '')
  assert.equal(entry.foodName, 'Untracked dessert')
  assert.equal(entry.nutrition.calories, 250)
  assert.equal(entry.nutrition.protein, 10)
  assert.deepEqual(dailyTotals({ foods: [], mealEntries: [entry] }, '2026-08-12').calories, 250)
})

test('invalid food and quantity data is rejected', async () => {
  assert.throws(
    () =>
      createFood({
        name: { en: 'Bad' },
        serving: '100 g',
        nutrition: { calories: -1, protein: 0, fat: 0, carbohydrates: 0 },
        source: 'user',
      }),
    /Invalid data/,
  )

  const store = createMemoryStore()
  await assert.rejects(store.save({ ...data, mealEntries: [{ ...data.mealEntries[0], quantity: 0 }] }), /Invalid data/)
})

test('estimates deterministic targets and restores estimates after override removal', () => {
  const profile = {
    age: 30,
    sex: 'male' as const,
    heightCm: 180,
    weightKg: 80,
    activity: 'moderate' as const,
    targetWeightKg: 70,
    targetDate: '2027-01-01',
  }
  const estimated = estimateTargets(profile, '2026-08-12')
  assert.ok(estimateMaintenanceCalories(profile) > estimated.calories)
  assert.equal(estimateBMR(profile), 1780)
  assert.equal(estimateMaintenanceCalories({ ...profile, activity: 'bmrOnly' }), estimateBMR(profile))
  assert.ok(
    estimateTargets({ ...profile, targetDate: '2026-09-12' }, '2026-08-12').calories >
      estimateTargets({ ...profile, targetDate: '2026-08-19' }, '2026-08-12').calories,
  )
  assert.deepEqual(estimateTargets(profile, '2026-08-12'), estimated)
  assert.equal(resolveTargets(profile, { calories: 2000 }, '2026-08-12').calories, 2000)
  assert.equal(resolveTargets(profile, {}, '2026-08-12').calories, estimated.calories)
  assert.throws(() => estimateTargets({ ...profile, weightKg: 0 }), /Invalid data/)
  assert.throws(() => estimateTargets({ ...profile, targetDate: '2026-08-12' }, '2026-08-12'), /target date/)
})

test('keeps historical calorie ranges and streaks stable after a goal change', () => {
  const oldTargets = { calories: 2000, protein: 100, fat: 55, carbohydrates: 270 }
  const newTargets = { calories: 1800, protein: 100, fat: 50, carbohydrates: 230 }
  const mealFood = identifiedFood()
  const withOldGoal = setTargetPeriod(
    {
      foods: [mealFood],
      mealEntries: daySeries(3).map((date, index) => identifiedEntry(index, date, mealFood.id)),
    },
    oldTargets,
    '2026-08-01',
  )
  const withNewGoal = setTargetPeriod(withOldGoal, newTargets, fixedToday)

  assert.equal(targetsForDate(withNewGoal, '2026-08-03')?.calories, 2000)
  assert.equal(targetsForDate(withNewGoal, fixedToday)?.calories, 1800)
  assert.equal(calorieTone(dailyTotals(withNewGoal, '2026-08-03').calories, targetsForDate(withNewGoal, '2026-08-03')!.calories), 'on-target')
  assert.equal(calorieTone(dailyTotals(withNewGoal, '2026-08-03').calories, targetsForDate(withNewGoal, fixedToday)!.calories), 'over')
  assert.ok((evaluateAchievements(withNewGoal, fixedNow).achievements ?? []).some((record) => record.id === 'steady-starter'))

  const replacedToday = setTargetPeriod(withNewGoal, { ...newTargets, calories: 1900 }, fixedToday)
  assert.equal(replacedToday.targetPeriods?.length, 2)
  assert.equal(targetsForDate(replacedToday, fixedToday)?.calories, 1900)
})

test('migrates a legacy profile to one baseline target range', () => {
  const migrated = prepareAppData(
    { foods: [], mealEntries: [], profile: baseProfile, targetOverrides: { calories: 2000 } },
    fixedNow,
  )
  assert.equal(migrated.targetPeriods?.[0].effectiveFrom, '0001-01-01')
  assert.equal(targetsForDate(migrated, '2026-08-01')?.calories, 2000)
})

test('preserves target ranges through backup export and import', async () => {
  const source = createMemoryStore(
    setTargetPeriod(
      setTargetPeriod({ foods: [], mealEntries: [] }, { calories: 2000, protein: 100, fat: 55, carbohydrates: 270 }, '2026-08-01'),
      { calories: 1800, protein: 100, fat: 50, carbohydrates: 230 },
      fixedToday,
    ),
  )
  const target = createMemoryStore()
  await target.import(await source.export())

  assert.equal(targetsForDate(await target.load(), '2026-08-17')?.calories, 2000)
  assert.equal(targetsForDate(await target.load(), fixedToday)?.calories, 1800)
})

test('adds saved exercise calories to that day’s calorie target and preserves them through backup', async () => {
  const sourceData = setExerciseCalories(
    setTargetPeriod(
      { foods: [], mealEntries: [] },
      { calories: 2000, protein: 100, fat: 55, carbohydrates: 270 },
      fixedToday,
    ),
    fixedToday,
    300,
  )
  assert.equal(exerciseCaloriesForDate(sourceData, fixedToday), 300)
  assert.equal(calorieTargetForDate(sourceData, fixedToday), 2300)
  assert.equal(calorieTone(2300, calorieTargetForDate(sourceData, fixedToday)), 'on-target')
  assert.throws(() => setExerciseCalories(sourceData, fixedToday, -1), /exercise calories/)

  const source = createMemoryStore(sourceData)
  const target = createMemoryStore()
  await target.import(await source.export())
  assert.equal(exerciseCaloriesForDate(await target.load(), fixedToday), 300)
})

test('exports and imports a valid backup without changing supported data', async () => {
  const source = createMemoryStore(data)
  const target = createMemoryStore()
  await target.import(await source.export())
  assert.deepEqual(withoutAchievements(await target.load()), data)
})

test('rejects invalid backups without mutating existing data', async () => {
  const store = createMemoryStore(data)
  await assert.rejects(store.import('{"schemaVersion": 99}'), /Invalid backup/)
  assert.deepEqual(withoutAchievements(await store.load()), data)
})

test('previews valid backups and rejects unsupported versions before import', async () => {
  const backup = await createMemoryStore(data).export()
  assert.deepEqual(previewBackup(backup).data, data)
  assert.throws(() => previewBackup('{"schemaVersion": 99}'), /Unsupported backup version/)
})

test('imports by ID, replacing matches and preserving unrelated records', async () => {
  const extraFood = createFood({
    id: 'extra-food',
    name: { en: 'Apple' },
    serving: '1 piece',
    nutrition: { calories: 80, protein: 0, fat: 0, carbohydrates: 21 },
    source: 'user',
  })
  const extraMeal = createMealEntry(
    {
      id: 'extra-meal',
      date: '2026-08-12',
      time: '09:00',
      foodId: extraFood.id,
      quantity: 1,
    },
    extraFood,
  )
  const target = createMemoryStore({
    ...data,
    foods: [...data.foods, extraFood],
    mealEntries: [...data.mealEntries, extraMeal],
  })
  const source = createMemoryStore({
    ...data,
    foods: [createFood({ ...data.foods[0], name: { en: 'Brown rice' } })],
    mealEntries: [
      createMealEntry(
        {
          ...data.mealEntries[0],
          quantity: 3,
        },
        data.foods[0],
      ),
    ],
  })

  await target.import(await source.export())
  const imported = await target.load()
  assert.equal(imported.foods.find((item) => item.id === 'user-1')?.name.en, 'Brown rice')
  assert.equal(imported.mealEntries.find((item) => item.id === 'meal-1')?.quantity, 3)
  assert.ok(imported.foods.some((item) => item.id === 'extra-food'))
  assert.ok(imported.mealEntries.some((item) => item.id === 'extra-meal'))
})

function scenarioDataForAchievement(id: (typeof achievementDefinitions)[number]['id'], atBoundary: boolean): AppData {
  const threshold = (value: number) => (atBoundary ? value : value - 1)
  switch (id) {
    case 'ready-set':
      return atBoundary ? { foods: [], mealEntries: [], profile: baseProfile, targetOverrides: { calories: 2000 } } : { foods: [], mealEntries: [] }
    case 'first-plate':
    case 'tenfold-log':
    case 'fifty-plates':
    case 'hundred-plates': {
      const counts = { 'first-plate': 1, 'tenfold-log': 10, 'fifty-plates': 50, 'hundred-plates': 100 }
      const count = threshold(counts[id])
      const mealFood = identifiedFood()
      return {
        foods: [mealFood],
        mealEntries: Array.from({ length: count }, (_, index) => identifiedEntry(index, '2026-08-01', mealFood.id)),
      }
    }
    case 'quick-start': {
      const count = threshold(5)
      return { foods: [], mealEntries: Array.from({ length: count }, (_, index) => temporaryEntry(index, '2026-08-01')) }
    }
    case 'three-day-start':
    case 'week-witness':
    case 'monthly-companion':
    case 'hundred-day-journal': {
      const counts = { 'three-day-start': 3, 'week-witness': 7, 'monthly-companion': 30, 'hundred-day-journal': 100 }
      const count = threshold(counts[id])
      return { foods: [], mealEntries: daySeries(count).map((date, index) => temporaryEntry(index, date)) }
    }
    case 'steady-starter':
    case 'seven-day-rhythm':
    case 'two-week-pace':
    case 'monthly-rhythm': {
      const counts = { 'steady-starter': 3, 'seven-day-rhythm': 7, 'two-week-pace': 14, 'monthly-rhythm': 30 }
      const count = threshold(counts[id])
      const mealFood = identifiedFood()
      return {
        foods: [mealFood],
        mealEntries: daySeries(count).map((date, index) => identifiedEntry(index, date, mealFood.id)),
        profile: baseProfile,
        targetOverrides: { calories: 2000 },
      }
    }
    case 'familiar-favorite':
    case 'regular':
    case 'signature-order': {
      const counts = { 'familiar-favorite': 10, regular: 25, 'signature-order': 50 }
      const count = threshold(counts[id])
      const mealFood = identifiedFood()
      return {
        foods: [mealFood],
        mealEntries: Array.from({ length: count }, (_, index) => identifiedEntry(index, '2026-08-01', mealFood.id)),
      }
    }
    case 'ten-tastes':
    case 'twenty-five-tastes':
    case 'fifty-tastes': {
      const counts = { 'ten-tastes': 10, 'twenty-five-tastes': 25, 'fifty-tastes': 50 }
      const count = threshold(counts[id])
      const foods = Array.from({ length: count }, (_, index) => identifiedFood(`food-${index + 1}`, `Food ${index + 1}`))
      return {
        foods,
        mealEntries: foods.map((mealFood, index) => identifiedEntry(index, '2026-08-01', mealFood.id)),
      }
    }
    case 'first-custom-food':
    case 'personal-pantry': {
      const counts = { 'first-custom-food': 1, 'personal-pantry': 5 }
      const count = threshold(counts[id])
      return {
        foods: Array.from({ length: count }, (_, index) => identifiedFood(`custom-${index + 1}`, `Custom ${index + 1}`)),
        mealEntries: [],
      }
    }
  }
  throw new Error(`Unhandled achievement scenario: ${id}`)
}

test('each of the 22 achievement thresholds unlocks exactly at its boundary and not one below', () => {
  for (const definition of achievementDefinitions) {
    const below = evaluateAchievements(scenarioDataForAchievement(definition.id, false), fixedNow)
    assert.ok(
      !(below.achievements ?? []).some((record) => record.id === definition.id),
      `${definition.id} should stay locked one below`,
    )
    const at = evaluateAchievements(scenarioDataForAchievement(definition.id, true), fixedNow)
    assert.ok(
      (at.achievements ?? []).some((record) => record.id === definition.id),
      `${definition.id} should unlock at its threshold`,
    )
  }
})

test('batches simultaneous unlocks in definition order with one shared timestamp', () => {
  const batched = evaluateAchievements(
    {
      foods: [],
      mealEntries: Array.from({ length: 5 }, (_, index) => temporaryEntry(index, daySeries(3)[index % 3])),
      profile: baseProfile,
      targetOverrides: { calories: 2000 },
    },
    fixedNow,
  )
  assert.deepEqual(
    (batched.achievements ?? []).map((record) => record.id),
    ['ready-set', 'first-plate', 'quick-start', 'three-day-start', 'steady-starter'],
  )
  assert.ok((batched.achievements ?? []).every((record) => record.unlockedAt === fixedNow))
})

test('uses the shared at-or-below-target range and gaps break qualifying streaks', () => {
  assert.equal(calorieTone(1, 2000), 'on-target')
  assert.equal(calorieTone(2000, 2000), 'on-target')
  assert.equal(calorieTone(2001, 2000), 'over')

  const mealFood = identifiedFood()
  const gappedRun = evaluateAchievements(
    {
      foods: [mealFood],
      mealEntries: [
        identifiedEntry(1, '2026-08-01', mealFood.id),
        identifiedEntry(2, '2026-08-02', mealFood.id),
        identifiedEntry(3, '2026-08-04', mealFood.id),
      ],
      profile: baseProfile,
      targetOverrides: { calories: 2000 },
    },
    fixedNow,
  )
  assert.ok(!(gappedRun.achievements ?? []).some((record) => record.id === 'steady-starter'))
})

test('counts quick adds but excludes them from food-specific achievements, while deleted food IDs still count', () => {
  const quickStart = evaluateAchievements(
    { foods: [], mealEntries: Array.from({ length: 5 }, (_, index) => temporaryEntry(index, '2026-08-01')) },
    fixedNow,
  )
  assert.ok((quickStart.achievements ?? []).some((record) => record.id === 'quick-start'))
  assert.ok(!(quickStart.achievements ?? []).some((record) => record.id === 'familiar-favorite'))
  assert.ok(!(quickStart.achievements ?? []).some((record) => record.id === 'ten-tastes'))

  const deletedFoodHistory = evaluateAchievements(
    {
      foods: [],
      mealEntries: Array.from({ length: 10 }, (_, index) => identifiedEntry(index, '2026-08-01', 'deleted-food')),
    },
    fixedNow,
  )
  assert.ok((deletedFoodHistory.achievements ?? []).some((record) => record.id === 'familiar-favorite'))
})

test('preserves unlockedAt and readAt through export/import and never removes unlocked records', async () => {
  const sourceData = markAchievementsRead(
    evaluateAchievements(
      {
        foods: [identifiedFood()],
        mealEntries: [identifiedEntry(1, fixedToday)],
        profile: baseProfile,
        targetOverrides: { calories: 2000 },
      },
      fixedNow,
    ),
    '2026-08-19T04:49:42.173Z',
  )

  const source = createMemoryStore()
  await source.save(sourceData)
  const target = createMemoryStore()
  await target.import(await source.export())
  assert.deepEqual((await target.load()).achievements, sourceData.achievements)

  const later = evaluateAchievements({ ...sourceData, mealEntries: [] }, '2026-08-20T04:49:42.173Z')
  assert.ok((later.achievements ?? []).some((record) => record.id === 'ready-set'))
  assert.ok((later.achievements ?? []).some((record) => record.id === 'first-plate'))
})

test('resolves dark mode from explicit preference or system when set to system', () => {
  assert.equal(resolveDarkMode('light', true), false)
  assert.equal(resolveDarkMode('dark', false), true)
  assert.equal(resolveDarkMode('system', true), true)
  assert.equal(resolveDarkMode('system', false), false)
})
