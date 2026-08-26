<script lang="ts">
  import { dailyTotals, roundForDisplay, type AppData } from '../domain/store'
  import { formatDate, t } from '../lib/i18n.svelte'

  type Day = { iso: string; number: number }

  let {
    data,
    date,
    today,
    recentDays,
    dayTones,
    onSelectDate,
  }: {
    data: AppData
    date: string
    today: string
    recentDays: Day[]
    dayTones: Record<string, string>
    onSelectDate: (iso: string) => void
  } = $props()

  const displayNumber = roundForDisplay
</script>

<div class="day-strip" aria-label={t('recentDays')}>
  {#each recentDays as day}
    {@const dayCalories = dailyTotals(data, day.iso).calories}
    {@const tone = dayTones[day.iso]}
    {@const dayLabel = formatDate(day.iso, { weekday: 'short' })}
    <button
      type="button"
      class:selected={date === day.iso}
      class:font-bold={day.iso === today}
      class:under={tone === 'under'}
      class:on-target={tone === 'on-target'}
      class:over={tone === 'over'}
      class:danger={tone === 'danger'}
      class:empty={tone === 'empty'}
      aria-pressed={date === day.iso}
      aria-label={`${dayLabel} ${day.number}, ${displayNumber(dayCalories)} kcal`}
      onclick={() => onSelectDate(day.iso)}
    >
      <span class="day-label">{dayLabel}</span>
      <span
        class="flex aspect-square w-[min(2rem,100%)] items-center justify-center rounded-full border"
        class:border-dashed={tone === 'empty'}
        class:border-2={tone !== 'empty'}
        class:border-solid={tone !== 'empty' || day.iso === today}
        class:border-[var(--muted-foreground)]={tone === 'empty'}
        class:border-[var(--calorie-under)]={tone === 'under' || tone === 'on-target'}
        class:border-[var(--calorie-over)]={tone === 'over'}
        class:border-[var(--calorie-danger)]={tone === 'danger'}
        aria-hidden="true"><span>{day.number}</span></span
      >
    </button>
  {/each}
</div>
