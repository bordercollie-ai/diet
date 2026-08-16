import { test, expect, beforeEach } from 'vitest'
import { foodName, getLanguage, setLanguage, t } from '../src/lib/i18n.svelte'

beforeEach(() => {
  setLanguage('en')
})

test('persists the selected language and switches translated strings', () => {
  expect(t('menu')).toBe('Menu')

  setLanguage('ja')
  expect(getLanguage()).toBe('ja')
  expect(localStorage.getItem('diet-language')).toBe('ja')
  expect(t('menu')).toBe('メニュー')

  setLanguage('zh')
  expect(t('menu')).toBe('菜单')
})

test('falls back to English for a key missing in the current language', () => {
  setLanguage('ja')
  expect(t('not-a-real-key')).toBe('')
})

test('picks the food name matching the current language, falling back to English then Japanese', () => {
  const name = { en: 'Rice ball', ja: 'おにぎり', zh: '饭团' }
  setLanguage('zh')
  expect(foodName(name)).toBe('饭团')

  setLanguage('en')
  expect(foodName(name)).toBe('Rice ball')

  const japaneseOnly = { ja: 'えびフィレオ' }
  expect(foodName(japaneseOnly)).toBe('えびフィレオ')
})
