import { render } from '@testing-library/svelte'
import { test, expect, vi } from 'vitest'
import SwipeLayerHarness from './fixtures/swipe-layer-harness.svelte'

function dispatchTouch(target: EventTarget, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as unknown as TouchEvent
  const touch = { clientX: x, clientY: y } as Touch
  // @ts-expect-error jsdom has no TouchEvent constructor; fake the fields swipeBack reads.
  event.touches = type === 'touchend' ? [] : [touch]
  // @ts-expect-error see above
  event.changedTouches = [touch]
  target.dispatchEvent(event)
}

test('swiping right over empty page space below short content still triggers back', async () => {
  const onBack = vi.fn()
  render(SwipeLayerHarness, { props: { onBack } })

  // The rendered content is short, so this touch point is below the wrapper's own
  // box — i.e. it lands on an ancestor (document.body here), not a descendant of
  // the swipeable node. A real page has the same gap whenever content doesn't
  // fill the viewport (e.g. the calendar page's bottom half).
  dispatchTouch(document.body, 'touchstart', 10, 900)
  dispatchTouch(document.body, 'touchmove', 200, 900)
  dispatchTouch(document.body, 'touchend', 200, 900)

  expect(onBack).toHaveBeenCalledOnce()
})

test('scrolling vertically with rightward drift does not trigger back', () => {
  const onBack = vi.fn()
  render(SwipeLayerHarness, { props: { onBack } })

  dispatchTouch(document.body, 'touchstart', 10, 100)
  dispatchTouch(document.body, 'touchmove', 120, 500)
  dispatchTouch(document.body, 'touchend', 120, 500)

  expect(onBack).not.toHaveBeenCalled()
})

test('swiping a stacked (topmost) sheet does not also trigger an older sheet underneath', async () => {
  const outerBack = vi.fn()
  const innerBack = vi.fn()
  const outer = document.createElement('div')
  document.body.appendChild(outer)
  const inner = document.createElement('div')
  document.body.appendChild(inner)
  const { swipeBack } = await import('../src/lib/actions/swipe-back')
  const outerAction = swipeBack(outer, outerBack)
  const innerAction = swipeBack(inner, innerBack)

  dispatchTouch(document.body, 'touchstart', 10, 50)
  dispatchTouch(document.body, 'touchmove', 200, 50)
  dispatchTouch(document.body, 'touchend', 200, 50)

  expect(innerBack).toHaveBeenCalledOnce()
  expect(outerBack).not.toHaveBeenCalled()

  innerAction.destroy()
  outerAction.destroy()
  outer.remove()
  inner.remove()
})

test('the previous screen stays mounted underneath so dragging reveals real content', () => {
  const { getByText } = render(SwipeLayerHarness, { props: { onBack: vi.fn() } })

  // Both layers must be in the DOM at once — this is what makes the drag a real
  // reveal instead of a transform trick over blank space.
  expect(getByText('Back content')).toBeTruthy()
  expect(getByText('Front content')).toBeTruthy()
})
