import { render, screen, fireEvent } from '@testing-library/svelte'
import { test, expect } from 'vitest'
import { createFood, encodeFoodShareCode, type AppData } from '../src/domain/store'
import FoodsPanel from '../src/pages/FoodsPanel.svelte'

test('truncates a long food name instead of wrapping it onto a second line', () => {
  const longName = 'Roasted Soy Sauce Egg Bacon Thick Beef Patty Deluxe Cheeseburger Combo Meal'
  const food = createFood({
    name: { en: longName },
    serving: '1 serving',
    nutrition: { calories: 500, protein: 10, fat: 10, carbohydrates: 10 },
    source: 'user'
  })
  const data: AppData = { foods: [food], mealEntries: [] }

  render(FoodsPanel, { data, onAddFood: () => {}, onEditFood: () => {}, onImportFood: () => {} })

  const name = screen.getByText(longName)
  expect(name.className).toContain('truncate')
  expect(name.className).toContain('min-w-0')
  // The row must allow its cells to shrink below content size, otherwise the
  // grid track grows to fit the unbreakable text and truncate has no effect.
  expect(name.closest('button')?.className).toContain('min-w-0')
})

test('lists custom foods most recently updated first', () => {
  const older = createFood({
    id: 'older',
    name: { en: 'Older Food' },
    serving: '1 serving',
    nutrition: { calories: 100, protein: 1, fat: 1, carbohydrates: 1 },
    source: 'user',
    updatedAt: '2020-01-01T00:00:00.000Z'
  })
  const newer = createFood({
    id: 'newer',
    name: { en: 'Newer Food' },
    serving: '1 serving',
    nutrition: { calories: 100, protein: 1, fat: 1, carbohydrates: 1 },
    source: 'user',
    updatedAt: '2024-01-01T00:00:00.000Z'
  })
  const data: AppData = { foods: [older, newer], mealEntries: [] }

  render(FoodsPanel, { data, onAddFood: () => {}, onEditFood: () => {}, onImportFood: () => {} })

  const names = screen.getAllByRole('button').map((button) => button.textContent).filter((text) => text?.includes('Food'))
  expect(names.findIndex((text) => text?.includes('Newer Food'))).toBeLessThan(
    names.findIndex((text) => text?.includes('Older Food')),
  )
})

test('shows a star only next to favorited custom foods', () => {
  const favorite = createFood({
    id: 'favorite',
    name: { en: 'Favorite Food' },
    serving: '1 serving',
    nutrition: { calories: 100, protein: 1, fat: 1, carbohydrates: 1 },
    source: 'user'
  })
  const plain = createFood({
    id: 'plain',
    name: { en: 'Plain Food' },
    serving: '1 serving',
    nutrition: { calories: 100, protein: 1, fat: 1, carbohydrates: 1 },
    source: 'user'
  })
  const data: AppData = { foods: [favorite, plain], mealEntries: [], favoriteFoodIds: ['favorite'] }

  render(FoodsPanel, { data, onAddFood: () => {}, onEditFood: () => {}, onImportFood: () => {} })

  const favoriteRow = screen.getByText('Favorite Food').closest('button')
  const plainRow = screen.getByText('Plain Food').closest('button')
  expect(favoriteRow?.querySelector('svg.lucide-star')).not.toBeNull()
  expect(plainRow?.querySelector('svg.lucide-star')).toBeNull()
})

test('pasting a valid shared food code imports it', async () => {
  const shared = createFood({
    name: { en: 'Shared Onigiri' },
    serving: '1 piece',
    nutrition: { calories: 180, protein: 4, fat: 1, carbohydrates: 39 },
    source: 'user'
  })
  const code = encodeFoodShareCode(shared)
  const data: AppData = { foods: [], mealEntries: [] }
  let imported: unknown = null

  render(FoodsPanel, {
    data,
    onAddFood: () => {},
    onEditFood: () => {},
    onImportFood: (input) => {
      imported = input
    }
  })

  await fireEvent.click(screen.getByRole('button', { name: 'Import food' }))
  await fireEvent.input(screen.getByLabelText('Paste a shared food code'), { target: { value: code } })
  await fireEvent.click(screen.getByRole('button', { name: 'Import' }))

  expect(imported).toMatchObject({ name: { en: 'Shared Onigiri' }, serving: '1 piece' })
})

test('pasting an invalid code shows an error and does not import', async () => {
  const data: AppData = { foods: [], mealEntries: [] }
  let imported = false

  render(FoodsPanel, {
    data,
    onAddFood: () => {},
    onEditFood: () => {},
    onImportFood: () => {
      imported = true
    }
  })

  await fireEvent.click(screen.getByRole('button', { name: 'Import food' }))
  await fireEvent.input(screen.getByLabelText('Paste a shared food code'), { target: { value: 'not a real code' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Import' }))

  expect((await screen.findByRole('alert')).textContent).toBe("That code isn't a valid shared food.")
  expect(imported).toBe(false)
})
