// Svelte action: swipe right (native touch events, no gesture library) to trigger
// a page's back/close handler. Listens on `window`, not `node`, so it fires even
// when the touch lands on empty page space below short content (space that isn't
// actually inside `node`'s own box, since the wrapper only grows to fit content).
// The transform is applied to `dragTarget` (defaults to `node`) — pass a narrower
// `dragTarget` when `node` itself shouldn't move (e.g. it's the fixed page whose
// real DOM neighbour is a *different* screen, not this step's "back" destination).
const THRESHOLD_PX = 80

type SwipeBackParams = (() => void) | { onBack: () => void; drag?: boolean; dragTarget?: HTMLElement }

function normalize(node: HTMLElement, params: SwipeBackParams) {
  return typeof params === 'function'
    ? { onBack: params, drag: true, dragTarget: node }
    : { onBack: params.onBack, drag: params.drag ?? true, dragTarget: params.dragTarget ?? node }
}

export function swipeBack(node: HTMLElement, params: SwipeBackParams) {
  let { onBack, drag, dragTarget } = normalize(node, params)
  let startX = 0
  let startY = 0
  let tracking = false

  function start(event: TouchEvent) {
    const touch = event.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    tracking = true
    dragTarget.style.transition = 'none'
  }

  function move(event: TouchEvent) {
    if (!tracking || !drag) return
    const touch = event.touches[0]
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY
    if (Math.abs(dy) > Math.abs(dx)) return
    dragTarget.style.transform = dx > 0 ? `translateX(${dx}px)` : ''
  }

  function end(event: TouchEvent) {
    if (!tracking) return
    tracking = false
    dragTarget.style.transition = ''
    dragTarget.style.transform = ''
    const dx = event.changedTouches[0].clientX - startX
    if (dx > THRESHOLD_PX) onBack()
  }

  window.addEventListener('touchstart', start, { passive: true })
  window.addEventListener('touchmove', move, { passive: true })
  window.addEventListener('touchend', end)

  return {
    update(next: SwipeBackParams) {
      ;({ onBack, drag, dragTarget } = normalize(node, next))
    },
    destroy() {
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    },
  }
}
