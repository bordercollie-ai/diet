<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'

  let { label = 'Back', onclick }: { label?: string; onclick: () => void } = $props()
</script>

<Button type="button" variant="ghost" size="sm" class="mb-2 -ml-3 gap-0.5 text-foreground" {onclick}>
  <ChevronLeftIcon aria-hidden="true" class="size-5" />
  {label}
</Button>
