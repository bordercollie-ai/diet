import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
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
  await fireEvent.click(screen.getByRole('button', { name: 'Record a meal' }))
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

test('records a McDonald\'s Japan meal found by its English name', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('button', { name: 'Record a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(await screen.findByRole('button', { name: /Big Mac®/ }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => {
    expect(screen.getByRole('img', { name: /^524 of \d+ kcal/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Big Mac®, 524 kcal\. Open meal actions\./ })).toBeTruthy()
  })
})

test('records a McDonald\'s Japan meal found by its Japanese name', async () => {
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('button', { name: 'Record a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'ビッグマック' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await fireEvent.click(await screen.findByRole('button', { name: /Big Mac®/ }))
  await fireEvent.click(screen.getByRole('button', { name: 'Add meal' }))

  await waitFor(() => {
    expect(screen.getByRole('img', { name: /^524 of \d+ kcal/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Big Mac®, 524 kcal\. Open meal actions\./ })).toBeTruthy()
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

test("shows a bundled food's brand/description in the Record a meal search results", async () => {
  storeOverride = undefined
  render(App)

  await screen.findByRole('tabpanel', { name: 'Summary' })
  await fireEvent.click(screen.getByRole('button', { name: 'Record a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  await waitFor(() => expect(screen.getAllByText("McDonald's Japan").length).toBeGreaterThan(0))
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
  await fireEvent.click(screen.getByRole('button', { name: 'Record a meal' }))
  await fireEvent.input(screen.getByLabelText('Search food'), { target: { value: 'Big Mac' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  await waitFor(() => expect(screen.getAllByText("McDonald's Japan").length).toBeGreaterThan(0))
})
