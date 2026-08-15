import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { vi, test, expect } from 'vitest'
import { createMemoryStore, type AppData } from '../src/domain/store'
import App from '../src/App.svelte'

let storeOverride: AppData | undefined
vi.mock('../src/storage/indexeddb', () => ({
  createIndexedDBStore: () => createMemoryStore(storeOverride)
}))

test('records 1.4 servings of a 68 kcal food and displays rounded calories', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
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
})

test('quantity does not carry over from a previous meal into a new "Add a meal" entry', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
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
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: '68 kcal snack' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  const dialog = await screen.findByRole('dialog')
  await fireEvent.click(await within(dialog).findByRole('button', { name: /68 kcal snack/ }))

  expect((await screen.findByLabelText('Quantity') as HTMLInputElement).value).toBe('1')
})

test('clicking a recorded meal opens edit directly, and delete asks for confirmation', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
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
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /68 kcal snack.*Edit meal\./ })).toBeNull(),
  )
})

test('records a McDonald\'s Japan meal found by its English name', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(await screen.findByRole('button', { name: /Big Mac®/ }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => {
    expect(screen.getByRole('img', { name: /^524 of \d+ kcal/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Big Mac®, 524 kcal\. Edit meal\./ })).toBeTruthy()
  })
})

test('records a McDonald\'s Japan meal found by its Japanese name', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'ビッグマック' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(await screen.findByRole('button', { name: /Big Mac®/ }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => {
    expect(screen.getByRole('img', { name: /^524 of \d+ kcal/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Big Mac®, 524 kcal\. Edit meal\./ })).toBeTruthy()
  })
})

test('records a quick entry with calories and macros without creating a food', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
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
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  await waitFor(() => expect(screen.getAllByText("McDonald's Japan").length).toBeGreaterThan(0))
})

test('adds a custom food to today\'s meal from its detail/edit view', async () => {
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
  await fireEvent.click(screen.getByRole('button', { name: 'Add a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  await waitFor(() => expect(screen.getAllByText("McDonald's Japan").length).toBeGreaterThan(0))
})
