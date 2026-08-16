<script lang="ts">
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import { swipeBack } from '$lib/actions/swipe-back'
  import NavCircleButton from './nav-circle-button.svelte'
  import type { Snippet } from 'svelte'

  let {
    label = 'Back',
    onclick,
    children,
  }: { label?: string; onclick: () => void; children?: Snippet } = $props()
</script>

<div use:swipeBack={onclick}>
  <div class="-mx-3 mb-3 border-b px-3 pb-2">
    <NavCircleButton {label} {onclick}>
      <ChevronLeftIcon aria-hidden="true" class="size-5" />
    </NavCircleButton>
  </div>
  {@render children?.()}
</div>
