// Svelte action: swipe right (native touch events, no gesture library) to trigger
// a page's back/close handler. Listens on `window`, not `node`, so it fires even
// when the touch lands on empty page space below short content (space that isn't
// actually inside `node`'s own box, since the wrapper only grows to fit content).
// Dragging translates `node` itself — only use this on an element that has a real
// screen mounted behind it (see SwipeLayer), otherwise pass `drag: false`.
const THRESHOLD_PX = 80

type SwipeBackParams = (() => void) | { onBack: () => void; drag?: boolean }

function normalize(params: SwipeBackParams) {
  return typeof params === 'function'
    ? { onBack: params, drag: true }
    : { onBack: params.onBack, drag: params.drag ?? true }
}

// ponytail: stacked overlays (e.g. FoodSheet opened on top of MealSheet) each mount
// their own swipeBack. Every instance used to listen on window independently, so one
// swipe fired every active instance's onBack, not just the topmost sheet's — closing
// sheets underneath too. A single shared stack lets only the last-mounted (topmost)
// instance react; older instances just sit inert until they're back on top.
type Layer = { node: HTMLElement; onBack: () => void; drag: boolean }
const stack: Layer[] = []
let startX = 0
let startY = 0
let tracking = false

function start(event: TouchEvent) {
  const touch = event.touches[0]
  startX = touch.clientX
  startY = touch.clientY
  tracking = true
  const top = stack.at(-1)
  if (top) top.node.style.transition = 'none'
}

function move(event: TouchEvent) {
  const top = stack.at(-1)
  if (!tracking || !top?.drag) return
  const touch = event.touches[0]
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY
  if (Math.abs(dy) > Math.abs(dx)) return
  top.node.style.transform = dx > 0 ? `translateX(${dx}px)` : ''
}

function end(event: TouchEvent) {
  if (!tracking) return
  tracking = false
  const top = stack.at(-1)
  if (!top) return
  top.node.style.transition = ''
  top.node.style.transform = ''
  const dx = event.changedTouches[0].clientX - startX
  if (dx > THRESHOLD_PX) top.onBack()
}

let listening = false
function ensureListening() {
  if (listening) return
  listening = true
  window.addEventListener('touchstart', start, { passive: true })
  window.addEventListener('touchmove', move, { passive: true })
  window.addEventListener('touchend', end)
}

export function swipeBack(node: HTMLElement, params: SwipeBackParams) {
  ensureListening()
  const layer: Layer = { node, ...normalize(params) }
  stack.push(layer)

  return {
    update(next: SwipeBackParams) {
      Object.assign(layer, normalize(next))
    },
    destroy() {
      const index = stack.indexOf(layer)
      if (index !== -1) stack.splice(index, 1)
    },
  }
}
