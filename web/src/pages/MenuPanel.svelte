<script lang="ts">
  import * as Card from '$lib/components/ui/card'
  import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import UserIcon from '@lucide/svelte/icons/user'

  let { onSelect }: { onSelect: (page: 'profile' | 'calendar' | 'backup') => void } = $props()

  const items: { id: 'profile' | 'calendar' | 'backup'; label: string; icon: typeof CalendarDaysIcon }[] = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarDaysIcon },
    { id: 'backup', label: 'Export', icon: DownloadIcon },
  ]
</script>

<div id="menu-panel" role="tabpanel" aria-labelledby="menu-tab">
  <Card.Root class="p-0 overflow-hidden">
    <Card.Content class="p-0">
      {#each items as { id, label, icon: Icon }, index}
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left {index > 0 ? 'border-t' : ''}"
          onclick={() => onSelect(id)}
        >
          <Icon aria-hidden="true" class="size-5 text-muted-foreground" />
          <span class="flex-1">{label}</span>
          <ChevronRightIcon aria-hidden="true" class="size-4 text-muted-foreground" />
        </button>
      {/each}
    </Card.Content>
  </Card.Root>
</div>
