<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'

  let { label = 'Back', onclick }: { label?: string; onclick: () => void } = $props()
</script>

<div class="-mx-3 mb-3 border-b px-3 pb-2">
  <Button type="button" variant="ghost" size="icon" class="size-11 rounded-full" aria-label={label} {onclick}>
    <span class="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground">
      <ChevronLeftIcon aria-hidden="true" class="size-5" />
    </span>
  </Button>
</div>
