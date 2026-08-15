import { render, screen } from '@testing-library/svelte'
import { test, expect } from 'vitest'
import { createFood, type AppData } from '../src/domain/store'
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

  render(FoodsPanel, { data, onAddFood: () => {}, onEditFood: () => {} })

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

  render(FoodsPanel, { data, onAddFood: () => {}, onEditFood: () => {} })

  const names = screen.getAllByRole('button').map((button) => button.textContent).filter((text) => text?.includes('Food'))
  expect(names.findIndex((text) => text?.includes('Newer Food'))).toBeLessThan(
    names.findIndex((text) => text?.includes('Older Food')),
  )
})
