// Svelte action: swipe right (native touch events, no gesture library) to trigger
// a page's back/close handler. Listens on `window`, not `node`, so it fires even
// when the touch lands on empty page space below short content (space that isn't
// actually inside `node`'s own box, since the wrapper only grows to fit content).
// `node` is still what gets the visual drag transform.
const THRESHOLD_PX = 80

export function swipeBack(node: HTMLElement, onBack: () => void) {
  let startX = 0
  let startY = 0
  let tracking = false

  function start(event: TouchEvent) {
    const touch = event.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    tracking = true
    node.style.transition = 'none'
  }

  function move(event: TouchEvent) {
    if (!tracking) return
    const touch = event.touches[0]
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY
    if (Math.abs(dy) > Math.abs(dx)) return
    node.style.transform = dx > 0 ? `translateX(${dx}px)` : ''
  }

  function end(event: TouchEvent) {
    if (!tracking) return
    tracking = false
    node.style.transition = ''
    node.style.transform = ''
    const dx = event.changedTouches[0].clientX - startX
    if (dx > THRESHOLD_PX) onBack()
  }

  window.addEventListener('touchstart', start, { passive: true })
  window.addEventListener('touchmove', move, { passive: true })
  window.addEventListener('touchend', end)

  return {
    update(next: () => void) {
      onBack = next
    },
    destroy() {
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    },
  }
}
