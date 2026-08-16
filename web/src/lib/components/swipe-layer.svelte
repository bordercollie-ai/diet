<script lang="ts">
  import { swipeBack } from '$lib/actions/swipe-back'
  import type { Snippet } from 'svelte'

  // Minimal two-level nav stack: `back` stays mounted underneath `front`, so
  // swiping `front` away — or calling the same `onBack` from a button — reveals
  // the real previous screen, not blank space. Depth is always 2 (no call site
  // needs more); nest another SwipeLayer if a third level is ever needed.
  let { back, front, onBack }: { back: Snippet; front: Snippet; onBack: () => void } = $props()
</script>

<div class="relative h-full w-full overflow-hidden">
  <div class="absolute inset-0" inert>
    {@render back()}
  </div>
  <div class="absolute inset-0 bg-popover [touch-action:pan-y]" use:swipeBack={onBack}>
    {@render front()}
  </div>
</div>
