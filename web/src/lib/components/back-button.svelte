<script lang="ts">
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import NavCircleButton from './nav-circle-button.svelte'
  import type { Snippet } from 'svelte'

  let {
    label = 'Back',
    title,
    onclick,
    children,
  }: { label?: string; title?: string; onclick: () => void; children?: Snippet } = $props()
</script>

<div class="-mx-3 mb-3 flex items-center gap-3 border-b px-3 pb-2">
  <NavCircleButton {label} {onclick}>
    <ChevronLeftIcon aria-hidden="true" class="size-5" />
  </NavCircleButton>
  {#if title}<h1 class="text-lg font-semibold leading-none">{title}</h1>{/if}
</div>
{@render children?.()}
