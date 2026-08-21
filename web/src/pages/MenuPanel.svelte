<script lang="ts">
  import * as Card from '$lib/components/ui/card'
  import * as Select from '$lib/components/ui/select'
  import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import GlobeIcon from '@lucide/svelte/icons/globe'
  import InfoIcon from '@lucide/svelte/icons/info'
  import MonitorIcon from '@lucide/svelte/icons/monitor'
  import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal'
  import UserIcon from '@lucide/svelte/icons/user'
  import type { ThemePreference } from '../domain/store'
  import { t, type Language } from '../lib/i18n.svelte'

  let {
    onSelect,
    themePreference,
    onThemeChange,
    language,
    onLanguageChange,
  }: {
    onSelect: (page: 'profile' | 'calendar' | 'backup' | 'advanced' | 'about') => void
    themePreference: ThemePreference
    onThemeChange: (preference: ThemePreference) => void
    language: Language
    onLanguageChange: (language: Language) => void
  } = $props()

  const items: {
    id: 'profile' | 'calendar' | 'backup' | 'advanced' | 'about'
    labelKey: string
    icon: typeof CalendarDaysIcon
  }[] = [
    { id: 'profile', labelKey: 'profile', icon: UserIcon },
    { id: 'calendar', labelKey: 'calendar', icon: CalendarDaysIcon },
    { id: 'backup', labelKey: 'export', icon: DownloadIcon },
    { id: 'advanced', labelKey: 'advanced', icon: SlidersHorizontalIcon },
    { id: 'about', labelKey: 'about', icon: InfoIcon },
  ]

  const themeOptions: { value: ThemePreference; labelKey: string }[] = [
    { value: 'light', labelKey: 'light' },
    { value: 'dark', labelKey: 'dark' },
    { value: 'system', labelKey: 'system' },
  ]
  const languageOptions: { value: Language; labelKey: string }[] = [
    { value: 'en', labelKey: 'english' },
    { value: 'zh', labelKey: 'chinese' },
    { value: 'ja', labelKey: 'japanese' },
  ]

  const themeLabel = $derived(t(themeOptions.find((option) => option.value === themePreference)?.labelKey ?? 'system'))
  const languageLabel = $derived(t(languageOptions.find((option) => option.value === language)?.labelKey ?? 'english'))
</script>

<div id="menu-panel" role="tabpanel" aria-labelledby="menu-tab">
  <Card.Root class="p-0 overflow-hidden">
    <Card.Content class="p-0">
      <div class="flex h-14 w-full items-center gap-3">
        <GlobeIcon aria-hidden="true" class="size-5 text-muted-foreground" />
        <span class="flex-1 text-lg">{t('language')}</span>
        <Select.Root
          type="single"
          value={language}
          onValueChange={(value) => value && onLanguageChange(value as Language)}
        >
          <Select.Trigger
            aria-label={t('language')}
            class="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {languageLabel}
          </Select.Trigger>
          <Select.Content class="rounded-md">
            {#each languageOptions as option}
              <Select.Item value={option.value} label={t(option.labelKey)} class="rounded-sm" />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex h-14 w-full items-center gap-3">
        <MonitorIcon aria-hidden="true" class="size-5 text-muted-foreground" />
        <span class="flex-1 text-lg">{t('appearance')}</span>
        <Select.Root
          type="single"
          value={themePreference}
          onValueChange={(value) => value && onThemeChange(value as ThemePreference)}
        >
          <Select.Trigger
            aria-label={t('theme')}
            class="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {themeLabel}
          </Select.Trigger>
          <Select.Content class="rounded-md">
            {#each themeOptions as option}
              <Select.Item value={option.value} label={t(option.labelKey)} class="rounded-sm" />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      {#each items as { id, labelKey, icon: Icon }}
        <button type="button" class="flex h-14 w-full items-center gap-3 text-left" onclick={() => onSelect(id)}>
          <Icon aria-hidden="true" class="size-5 text-muted-foreground" />
          <span class="flex-1 text-lg">{t(labelKey)}</span>
          <ChevronRightIcon aria-hidden="true" class="size-4 text-muted-foreground" />
        </button>
      {/each}
    </Card.Content>
  </Card.Root>
</div>
