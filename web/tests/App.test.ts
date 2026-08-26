import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, vi, test, expect } from 'vitest'
import { createFood, createMemoryStore, type AppData } from '../src/domain/store'
import { setLanguage } from '../src/lib/i18n.svelte'
import App from '../src/App.svelte'

let storeOverride: AppData | undefined

beforeEach(() => {
  storeOverride = undefined
  setLanguage('en')
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function openAddMealMenu() {
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal options' }))
}

const trophyStoreData = (): AppData => ({
  foods: [],
  mealEntries: [],
  achievements: [
    { id: 'ready-set', unlockedAt: '2026-08-18T04:49:42.173Z' },
    { id: 'first-plate', unlockedAt: '2026-08-18T04:49:42.173Z' },
    { id: 'quick-start', unlockedAt: '2026-08-12T04:49:42.173Z', readAt: '2026-08-12T05:00:00.000Z' },
  ],
})

vi.mock('../src/storage/indexeddb', () => ({
  createIndexedDBStore: () => createMemoryStore(storeOverride),
}))

test('records 1.4 servings of a 68 kcal food and displays rounded calories', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: '68 kcal snack' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add food' }))

  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: '68 kcal snack' } })
  await fireEvent.input(screen.getByLabelText('Calories'), { target: { value: '68' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save food' }))
  await fireEvent.input(screen.getByLabelText('Quantity'), { target: { value: '1.4' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => expect(screen.getAllByText('95 kcal')).toHaveLength(2))
  expect(screen.getByText('1.4 servings')).toBeTruthy()
})

test('shows the recorded serving quantity in Japanese', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const food = createFood({
    id: 'rice',
    name: { en: 'Rice' },
    serving: '1 serving',
    nutrition: { calories: 200, protein: 4, fat: 0, carbohydrates: 45 },
    source: 'user',
  })
  storeOverride = {
    foods: [food],
    mealEntries: [
      {
        id: 'meal',
        date: today,
        time: '12:00',
        foodId: food.id,
        quantity: 2,
        nutrition: { calories: 400, protein: 8, fat: 0, carbohydrates: 90 },
      },
    ],
  }
  setLanguage('ja')
  render(App)

  expect(await screen.findByText('2 食分')).toBeTruthy()
})

test('shows a food’s explicit serving in the home meal list', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const milk = createFood({
    id: 'milk',
    name: { en: 'Milk' },
    serving: '200 ml',
    nutrition: { calories: 100, protein: 7, fat: 4, carbohydrates: 10 },
    source: 'user',
  })
  storeOverride = {
    foods: [milk],
    mealEntries: [
      {
        id: 'meal',
        date: today,
        time: '12:00',
        foodId: milk.id,
        quantity: 1,
        nutrition: milk.nutrition,
      },
      {
        id: 'meal-two',
        date: today,
        time: '13:00',
        foodId: milk.id,
        quantity: 2,
        nutrition: { calories: 200, protein: 14, fat: 8, carbohydrates: 20 },
      },
    ],
  }
  render(App)

  expect(await screen.findAllByText('200 ml')).toHaveLength(1)
  expect(await screen.findByText('400 ml')).toBeTruthy()
})

test('rounds scaled servings to one decimal place', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const protein = createFood({
    id: 'protein',
    name: { en: 'Protein' },
    serving: '100.12 g',
    nutrition: { calories: 100, protein: 20, fat: 1, carbohydrates: 2 },
    source: 'user',
  })
  storeOverride = {
    foods: [protein],
    mealEntries: [
      {
        id: 'meal',
        date: today,
        time: '12:00',
        foodId: protein.id,
        quantity: 2,
        nutrition: { calories: 200, protein: 40, fat: 2, carbohydrates: 4 },
      },
    ],
  }
  render(App)

  expect(await screen.findByText('200.2 g')).toBeTruthy()
})

test('lists a favorited food before a non-favorited match in meal search results', async () => {
  const bun = createFood({
    id: 'plain-bun',
    name: { en: 'Plain Bun' },
    serving: '1 bun',
    nutrition: { calories: 150, protein: 4, fat: 2, carbohydrates: 28 },
    source: 'user',
  })
  const bunFavorite = createFood({
    id: 'favorite-bun',
    name: { en: 'Favorite Bun' },
    serving: '1 bun',
    nutrition: { calories: 160, protein: 4, fat: 2, carbohydrates: 30 },
    source: 'user',
  })
  storeOverride = { foods: [bun, bunFavorite], mealEntries: [], favoriteFoodIds: ['favorite-bun'] }
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'bun' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  const results = await screen.findAllByRole('button', { name: /Bun/ })
  expect(results[0].textContent).toContain('Favorite Bun')
  expect(results[1].textContent).toContain('Plain Bun')
})

test('toggles a food as favorite from its meal detail screen and persists it', async () => {
  const bun = createFood({
    id: 'plain-bun',
    name: { en: 'Plain Bun' },
    serving: '1 bun',
    nutrition: { calories: 150, protein: 4, fat: 2, carbohydrates: 28 },
    source: 'user',
  })
  storeOverride = { foods: [bun], mealEntries: [] }
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'bun' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(await screen.findByRole('button', { name: /Plain Bun/ }))

  const favoriteButton = await screen.findByRole('button', { name: 'Add to favorites' })
  await fireEvent.click(favoriteButton)

  await screen.findByRole('button', { name: 'Remove from favorites' })
  await fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'bun' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(await screen.findByRole('button', { name: /Plain Bun/ }))

  await screen.findByRole('button', { name: 'Remove from favorites' })
})

test('adds extra exercise calories to the selected day’s calorie target', async () => {
  const today = new Date().toISOString().slice(0, 10)
  storeOverride = {
    foods: [],
    mealEntries: [
      {
        id: 'temporary-1',
        date: today,
        time: '12:00',
        foodId: '',
        foodName: 'Lunch',
        quantity: 1,
        nutrition: { calories: 2100, protein: 20, fat: 10, carbohydrates: 250 },
      },
    ],
    targetPeriods: [{ effectiveFrom: '0001-01-01', targets: { calories: 2000, protein: 100, fat: 55, carbohydrates: 270 } }],
  }
  render(App)

  expect(await screen.findByRole('img', { name: /^2100 of 2000 kcal/ })).toBeTruthy()
  await fireEvent.click(screen.getByRole('button', { name: 'Extra exercise calories' }))
  const exerciseInput = screen.getByLabelText('Calories')
  expect((exerciseInput as HTMLInputElement).autocomplete).toBe('off')
  await fireEvent.input(exerciseInput, { target: { value: '100' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save exercise' }))

  await waitFor(() => expect(screen.getByRole('img', { name: /^2100 of 2100 kcal/ })).toBeTruthy())
})

test('clearing a nutrition field falls back to 0 instead of blocking the save', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'zero cal water' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add food' }))

  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'zero cal water' } })
  await fireEvent.input(screen.getByLabelText('Calories'), { target: { value: '68' } })
  // Clearing the field back to empty (e.g. to retype it) must not leave the form stuck.
  await fireEvent.input(screen.getByLabelText('Calories'), { target: { value: '' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save food' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => expect(screen.getAllByText('0 kcal')).toHaveLength(2))
})

test('quantity does not carry over from a previous meal into a new "Add a meal" entry', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: '68 kcal snack' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add food' }))

  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: '68 kcal snack' } })
  await fireEvent.input(screen.getByLabelText('Calories'), { target: { value: '68' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save food' }))
  await fireEvent.input(screen.getByLabelText('Quantity'), { target: { value: '1.4' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => expect(screen.getAllByText('95 kcal')).toHaveLength(2))

  // Record a second, unrelated meal of the same food and confirm quantity resets to 1.
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: '68 kcal snack' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  const dialog = await screen.findByRole('dialog')
  await fireEvent.click(await within(dialog).findByRole('button', { name: /68 kcal snack/ }))

  expect(((await screen.findByLabelText('Quantity')) as HTMLInputElement).value).toBe('1')
})

test('clicking a recorded meal opens edit directly, and delete asks for confirmation', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: '68 kcal snack' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add food' }))
  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: '68 kcal snack' } })
  await fireEvent.input(screen.getByLabelText('Calories'), { target: { value: '68' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save food' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => expect(screen.getAllByText('68 kcal').length).toBeGreaterThan(0))

  await fireEvent.click(await screen.findByRole('button', { name: /68 kcal snack.*Edit meal\./ }))
  expect(await screen.findByRole('button', { name: 'Update meal' })).toBeTruthy()

  await fireEvent.click(screen.getByRole('button', { name: 'Delete meal' }))
  const confirmDialog = await screen.findByRole('alertdialog')
  await fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(screen.getByRole('button', { name: /68 kcal snack.*Edit meal\./ })).toBeTruthy()

  await fireEvent.click(screen.getByRole('button', { name: 'Delete meal' }))
  const confirmDialogAgain = await screen.findByRole('alertdialog')
  await fireEvent.click(within(confirmDialogAgain).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: /68 kcal snack.*Edit meal\./ })).toBeNull())
})

test("records a McDonald's Japan meal found by its English name", async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(await screen.findByRole('button', { name: /Big Mac®/ }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => {
    expect(screen.getByRole('img', { name: /^524 of \d+ kcal/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Big Mac®, .+, 524 kcal\. Edit meal\./ })).toBeTruthy()
  })
})

test("records a McDonald's Japan meal found by its Japanese name", async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'ビッグマック' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(await screen.findByRole('button', { name: /Big Mac®/ }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => {
    expect(screen.getByRole('img', { name: /^524 of \d+ kcal/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Big Mac®, .+, 524 kcal\. Edit meal\./ })).toBeTruthy()
  })
})

test('records a quick entry with calories and macros without creating a food', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Quick add' }))
  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Dessert' } })
  await fireEvent.input(screen.getByLabelText('Calories'), { target: { value: '250' } })
  await fireEvent.input(screen.getByLabelText('Protein'), { target: { value: '10' } })
  await fireEvent.input(screen.getByLabelText('Fat'), { target: { value: '5' } })
  await fireEvent.input(screen.getByLabelText('Carbs'), { target: { value: '30' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => {
    expect(screen.getByText('Dessert')).toBeTruthy()
    expect(screen.getAllByText('250 kcal')).toHaveLength(2)
    expect(screen.getByText('10 g')).toBeTruthy()
  })
})

test("shows a bundled food's brand/description in the Add a meal search results", async () => {
  storeOverride = undefined
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  await waitFor(() => expect(screen.getAllByText("McDonald's Japan").length).toBeGreaterThan(0))
})

test("adds a custom food to today's meal from its detail/edit view", async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })

  // Create a custom food from the Foods tab.
  await fireEvent.click(screen.getByRole('tab', { name: 'Foods' }))
  await fireEvent.click(await screen.findByRole('button', { name: 'Add food' }))
  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Protein Bar' } })
  await fireEvent.input(screen.getByLabelText('Calories'), { target: { value: '200' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save food' }))

  // Open the food's detail/edit view and add it to today's meal directly — no
  // quantity/time step, it just records one serving at the current time.
  await fireEvent.click(await screen.findByRole('button', { name: /Edit Protein Bar/ }))
  await fireEvent.click(await screen.findByRole('button', { name: "Add to today's meal" }))

  // Back on the summary tab, the meal should now be recorded for today.
  await fireEvent.click(screen.getByRole('tab', { name: 'Summary' }))
  await waitFor(() => expect(screen.getAllByText('200 kcal').length).toBeGreaterThan(0))
})

test('refreshes a bundled food saved before the description field existed, so its brand appears on next load', async () => {
  // Simulate an install that persisted the McDonald's Japan Big Mac record before
  // this app version added `description` — the stored copy has no description.
  storeOverride = {
    foods: [
      {
        id: 'mcd-jp-1210',
        name: { en: 'Big Mac®', ja: 'ビッグマック®' },
        serving: '1 serving',
        nutrition: { calories: 524, protein: 26.4, fat: 28, carbohydrates: 41.8 },
        source: 'bundled',
      },
    ],
    mealEntries: [],
  }
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await openAddMealMenu()
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  await waitFor(() => expect(screen.getAllByText("McDonald's Japan").length).toBeGreaterThan(0))
})

test('opens Calendar from the menu page, jumps to a day, returns to calendar, and can back out to the menu', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('tab', { name: 'Menu' }))
  await screen.findByRole('tabpanel', { name: 'Menu' })
  await fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))

  const calendarPanel = await screen.findByRole('tabpanel', { name: 'Calendar' })
  const today = new Date().toISOString().slice(0, 10)
  await fireEvent.click(within(calendarPanel).getByRole('button', { name: new RegExp(`^${today}`) }))

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))

  await screen.findByRole('tabpanel', { name: 'Calendar' })
  await fireEvent.click(screen.getByRole('button', { name: 'Menu' }))

  await screen.findByRole('tabpanel', { name: 'Menu' })
})

test('picking a different day on the calendar does not change the Home tab date', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('tab', { name: 'Menu' }))
  await screen.findByRole('tabpanel', { name: 'Menu' })
  await fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))

  const calendarPanel = await screen.findByRole('tabpanel', { name: 'Calendar' })
  const today = new Date().toISOString().slice(0, 10)
  const [year, month, day] = today.split('-').map(Number)
  const otherDay = day === 1 ? 2 : 1
  const otherIso = `${year}-${String(month).padStart(2, '0')}-${String(otherDay).padStart(2, '0')}`
  await fireEvent.click(within(calendarPanel).getByRole('button', { name: new RegExp(`^${otherIso}$`) }))

  // Jumping from the calendar hides the day strip and shows the picked date as text instead.
  const calendarSummaryPanel = await screen.findByRole('tabpanel', { name: 'Summary' })
  expect(within(calendarSummaryPanel).queryByLabelText('Recent days')).toBeNull()
  const expectedLabel = new Date(`${otherIso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  expect(within(calendarSummaryPanel).queryByText(expectedLabel)).not.toBeNull()

  // Navigating Home via the bottom nav (not the "Calendar" back button) must show today, not the picked day.
  await fireEvent.click(screen.getByRole('tab', { name: 'Summary' }))
  const homePanel = await screen.findByRole('tabpanel', { name: 'Summary' })
  const selectedDayButton = homePanel.querySelector('.day-strip button.selected')
  expect(selectedDayButton?.textContent).toContain(String(day))
})

test('opens Profile from the menu page and returns via the back button', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('tab', { name: 'Menu' }))
  await screen.findByRole('tabpanel', { name: 'Menu' })
  await fireEvent.click(screen.getByRole('button', { name: 'Profile' }))

  await screen.findByRole('heading', { name: 'Profile and targets' })
  await fireEvent.click(screen.getByRole('button', { name: 'Menu' }))

  await screen.findByRole('tabpanel', { name: 'Menu' })
})

test('opens the header trophies list, shows unread items first, clears the dot, and does not replay read animations', async () => {
  storeOverride = trophyStoreData()
  const { container } = render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  expect(container.querySelector('.trophy-unread-dot')).not.toBeNull()

  await fireEvent.click(screen.getByRole('button', { name: 'Trophies' }))
  const allBadgesHeading = await screen.findByRole('heading', { name: 'All badges' })
  expect(screen.getByRole('heading', { name: 'New' })).toBeTruthy()
  expect(container.querySelectorAll('.achievement-card')).toHaveLength(22)
  expect(screen.getByRole('img', { name: 'Unlocked crown badge 1' })).toBeTruthy()
  expect(screen.getByRole('img', { name: 'Locked crown badge 14' })).toBeTruthy()
  expect(container.querySelectorAll('.achievement-card--enter').length).toBeGreaterThan(0)

  const newHeading = screen.getByRole('heading', { name: 'New' })
  const newSection = newHeading.parentElement?.querySelector('.achievement-list')
  expect(newSection?.textContent).toContain('Ready Set')
  const expectedNewTime = new Date('2026-08-18T04:49:42.173Z').toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  expect(within(newSection as HTMLElement).getAllByText(new RegExp(expectedNewTime.replace(',', ',?')))).toHaveLength(2)

  await waitFor(() => expect(container.querySelector('.trophy-unread-dot')).toBeNull())

  await fireEvent.click(screen.getByRole('button', { name: /Ready Set/ }))
  expect(await screen.findByRole('heading', { name: 'Ready Set' })).toBeTruthy()
  expect(container.querySelectorAll('[aria-hidden="true"] .achievement-list')).toHaveLength(2)
  expect(screen.getByText('Save a valid profile and target.')).toBeTruthy()
  expect(
    screen.getByText(
      new Date('2026-08-18T04:49:42.173Z').toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }),
    ),
  ).toBeTruthy()

  await fireEvent.click(screen.getAllByRole('button', { name: 'Trophies' }).at(-1)!)
  await screen.findByRole('heading', { name: 'All badges' })
  await fireEvent.click(screen.getByRole('button', { name: 'Diet' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Trophies' }))
  await screen.findByRole('heading', { name: 'All badges' })
  expect(screen.queryByRole('heading', { name: 'New' })).toBeNull()
  expect(container.querySelector('.achievement-card--enter')).toBeNull()
  expect(container.querySelector('.achievement-badge--enter')).toBeNull()
})

test('skips unread badge entrance classes when reduced motion is preferred', async () => {
  storeOverride = trophyStoreData()
  const realMatchMedia = window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) =>
      query === '(prefers-reduced-motion: reduce)'
        ? { matches: true, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} }
        : realMatchMedia(query),
  })

  const { container } = render(App)
  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('button', { name: 'Trophies' }))
  await screen.findByRole('heading', { name: 'All badges' })
  expect(container.querySelector('.achievement-card--enter')).toBeNull()
  expect(container.querySelector('.achievement-badge--enter')).toBeNull()
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: realMatchMedia })
})

test('exports backup via native share when Web Share API supports files', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  const canShare = vi.fn().mockReturnValue(true)
  Object.assign(navigator, { share, canShare })

  render(App)
  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('tab', { name: 'Menu' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Export JSON backup' }))

  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  const call = share.mock.calls[0][0]
  expect(call.files[0].name).toMatch(/^diet-backup-.*\.json$/)
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

test('falls back to anchor download when Web Share API is unavailable', async () => {
  const click = vi.fn()
  const anchor = { click, href: '', download: '' } as unknown as HTMLAnchorElement
  const realCreateElement = document.createElement.bind(document)
  const createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tag: string) => (tag === 'a' ? anchor : realCreateElement(tag)))

  render(App)
  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('tab', { name: 'Menu' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Export JSON backup' }))

  await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
  expect(anchor.download).toMatch(/^diet-backup-.*\.json$/)
  createElementSpy.mockRestore()
})
