<script lang="ts">
  import * as Card from '$lib/components/ui/card'
  import * as Select from '$lib/components/ui/select'
  import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import MonitorIcon from '@lucide/svelte/icons/monitor'
  import UserIcon from '@lucide/svelte/icons/user'
  import type { ThemePreference } from '../domain/store'

  let {
    onSelect,
    themePreference,
    onThemeChange,
  }: {
    onSelect: (page: 'profile' | 'calendar' | 'backup') => void
    themePreference: ThemePreference
    onThemeChange: (preference: ThemePreference) => void
  } = $props()

  const items: { id: 'profile' | 'calendar' | 'backup'; label: string; icon: typeof CalendarDaysIcon }[] = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarDaysIcon },
    { id: 'backup', label: 'Export', icon: DownloadIcon },
  ]

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ]
  const themeLabel = $derived(themeOptions.find((option) => option.value === themePreference)?.label ?? 'System')
</script>

<div id="menu-panel" role="tabpanel" aria-labelledby="menu-tab">
  <Card.Root class="p-0 overflow-hidden">
    <Card.Content class="p-0">
      <div class="flex h-14 w-full items-center gap-3 px-4">
        <MonitorIcon aria-hidden="true" class="size-5 text-muted-foreground" />
        <span class="flex-1 text-lg">Appearance</span>
        <Select.Root
          type="single"
          value={themePreference}
          onValueChange={(value) => value && onThemeChange(value as ThemePreference)}
        >
          <Select.Trigger aria-label="Theme" class="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            {themeLabel}
          </Select.Trigger>
          <Select.Content class="rounded-md">
            {#each themeOptions as option}
              <Select.Item value={option.value} label={option.label} class="rounded-sm" />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      {#each items as { id, label, icon: Icon }}
        <button
          type="button"
          class="flex h-14 w-full items-center gap-3 px-4 text-left border-t"
          onclick={() => onSelect(id)}
        >
          <Icon aria-hidden="true" class="size-5 text-muted-foreground" />
          <span class="flex-1 text-lg">{label}</span>
          <ChevronRightIcon aria-hidden="true" class="size-4 text-muted-foreground" />
        </button>
      {/each}
    </Card.Content>
  </Card.Root>
</div>
