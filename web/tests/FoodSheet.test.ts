import { render, screen, fireEvent } from '@testing-library/svelte'
import { test, expect, vi } from 'vitest'
import { flushSync } from 'svelte'
import { createFood, encodeFoodShareCode, type AppData } from '../src/domain/store'
import FoodSheet from '../src/pages/FoodSheet.svelte'

const shareableFood = () =>
  createFood({
    name: { en: 'Rice Ball' },
    serving: '1 piece',
    nutrition: { calories: 180, protein: 4, fat: 1, carbohydrates: 39 },
    source: 'user'
  })

test('a Share button appears only when editing an existing custom food, not when adding a new one', () => {
  const food = shareableFood()
  const data: AppData = { foods: [food], mealEntries: [] }
  const { component } = render(FoodSheet, { data, onSave: async () => {} })

  flushSync(() => component.openForNew())
  expect(screen.queryByRole('button', { name: 'Share food' })).toBeNull()

  flushSync(() => component.openForEdit(food))
  expect(screen.getByRole('button', { name: 'Share food' })).not.toBeNull()
})

test('the share dialog shows the exact code encodeFoodShareCode produces for that food', async () => {
  const food = shareableFood()
  const data: AppData = { foods: [food], mealEntries: [] }
  const { component } = render(FoodSheet, { data, onSave: async () => {} })

  flushSync(() => component.openForEdit(food))
  await fireEvent.click(screen.getByRole('button', { name: 'Share food' }))

  expect(screen.getByDisplayValue(encodeFoodShareCode(food))).not.toBeNull()
})

test('the copy text button copies the share code to the clipboard and confirms it', async () => {
  const food = shareableFood()
  const data: AppData = { foods: [food], mealEntries: [] }
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

  const { component } = render(FoodSheet, { data, onSave: async () => {} })
  flushSync(() => component.openForEdit(food))
  await fireEvent.click(screen.getByRole('button', { name: 'Share food' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Copy text code' }))

  expect(writeText).toHaveBeenCalledWith(encodeFoodShareCode(food))
  expect(await screen.findByText('Copied.')).not.toBeNull()
})
