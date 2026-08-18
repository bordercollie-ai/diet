<script lang="ts">
  import { calorieTargetForDate, calorieTone, dailyTotals, type AppData } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import { untrack } from 'svelte'
  import { formatDate, getLocale, t } from '../lib/i18n.svelte'

  let {
    data,
    today,
    onSelectDate,
  }: {
    data: AppData
    today: string
    onSelectDate: (iso: string) => void
  } = $props()

  // ponytail: calendar opens on today's month once and then navigates independently;
  // untrack marks that as deliberate, not a missed reactivity case.
  const initial = untrack(() => today.split('-').map(Number))
  let year = $state(initial[0])
  let month = $state(initial[1] - 1) // 0-indexed

  const monthLabel = $derived(formatDate(new Date(year, month, 1), { month: 'long', year: 'numeric' }))
  const weekdayLabels = $derived.by(() => {
    getLocale()
    const monday = new Date('2024-01-01T12:00:00')
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + index)
      return formatDate(day, { weekday: 'short' })
    })
  })
  const weeks = $derived.by(() => {
    const firstOfMonth = new Date(year, month, 1)
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (string | null)[] = [...Array(leadingBlanks).fill(null)]
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (string | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  })

  function changeMonth(delta: number) {
    const next = new Date(year, month + delta, 1)
    year = next.getFullYear()
    month = next.getMonth()
  }
</script>

<div id="calendar-panel" role="tabpanel" aria-label={t('calendar')}>
  <Card.Root>
    <Card.Content>
      <div class="flex items-center justify-between mb-3">
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('previousMonth')} onclick={() => changeMonth(-1)}>
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <strong>{monthLabel}</strong>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('nextMonth')} onclick={() => changeMonth(1)}>
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1" aria-hidden="true">
        {#each weekdayLabels as label}
          <span>{label}</span>
        {/each}
      </div>
      <div class="grid grid-cols-7 gap-3" role="grid" aria-label={t('calendar')}>
        {#each weeks as week}
          {#each week as iso}
            {#if iso}
              {@const tone = calorieTone(dailyTotals(data, iso).calories, calorieTargetForDate(data, iso))}
              <button
                type="button"
                class="aspect-square rounded-full border-2 text-sm flex items-center justify-center"
                class:font-bold={iso === today}
                class:border-transparent={tone === 'empty'}
                class:border-[var(--muted-foreground)]={tone === 'unavailable'}
                class:border-[var(--calorie-under)]={tone === 'under' || tone === 'on-target'}
                class:border-[var(--calorie-over)]={tone === 'over'}
                aria-label={`${iso}${iso === today ? `, ${t('today')}` : ''}`}
                onclick={() => onSelectDate(iso)}
              >
                {Number(iso.slice(-2))}
              </button>
            {:else}
              <span></span>
            {/if}
          {/each}
        {/each}
      </div>
    </Card.Content>
  </Card.Root>
</div>
