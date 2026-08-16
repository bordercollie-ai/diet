import { render } from '@testing-library/svelte'
import { test, expect, vi } from 'vitest'
import BackButton from '../src/lib/components/back-button.svelte'

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
  render(BackButton, { props: { onclick: onBack } })

  // The rendered content is short, so this touch point is below the wrapper's own
  // box — i.e. it lands on an ancestor (document.body here), not a descendant of
  // the swipeable node. A real page has the same gap whenever content doesn't
  // fill the viewport (e.g. the calendar page's bottom half).
  dispatchTouch(document.body, 'touchstart', 10, 900)
  dispatchTouch(document.body, 'touchmove', 200, 900)
  dispatchTouch(document.body, 'touchend', 200, 900)

  expect(onBack).toHaveBeenCalledOnce()
})
