<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import type { Snippet } from 'svelte'

  // Shared iOS-style nav control: a small circle icon sitting inside a larger
  // invisible tap target (44pt, Apple's minimum), used for every page-level
  // return and close button so they all look and behave the same.
  let {
    label,
    onclick,
    children,
  }: { label: string; onclick: () => void; children: Snippet } = $props()
</script>

<Button type="button" variant="ghost" size="icon" class="size-11 rounded-full" aria-label={label} {onclick}>
  <span class="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground">
    {@render children()}
  </span>
</Button>
