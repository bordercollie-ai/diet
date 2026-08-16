import { fireEvent, render, screen } from '@testing-library/svelte'
import { test, expect, vi } from 'vitest'
import MenuPanel from '../src/pages/MenuPanel.svelte'

test('choosing a theme option calls onThemeChange with the selected value', async () => {
  const onThemeChange = vi.fn()
  render(MenuPanel, {
    onSelect: () => {},
    themePreference: 'system',
    onThemeChange,
    language: 'en',
    onLanguageChange: () => {}
  })

  await fireEvent.pointerDown(screen.getByRole('button', { name: 'Theme' }))
  await fireEvent.pointerUp(await screen.findByRole('option', { name: 'Dark' }))

  expect(onThemeChange).toHaveBeenCalledWith('dark')
})

test('choosing a language option calls onLanguageChange with the selected value', async () => {
  const onLanguageChange = vi.fn()
  render(MenuPanel, {
    onSelect: () => {},
    themePreference: 'system',
    onThemeChange: () => {},
    language: 'en',
    onLanguageChange
  })

  await fireEvent.pointerDown(screen.getByRole('button', { name: 'Language' }))
  await fireEvent.pointerUp(await screen.findByRole('option', { name: '日本語' }))

  expect(onLanguageChange).toHaveBeenCalledWith('ja')
})
