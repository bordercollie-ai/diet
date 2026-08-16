<script lang="ts">
  import { roundForDisplay, type AppData, type Nutrition } from '../domain/store'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'
  import DayStrip from './DayStrip.svelte'
  import FlameIcon from '@lucide/svelte/icons/flame'
  import HamIcon from '@lucide/svelte/icons/ham'
  import WheatIcon from '@lucide/svelte/icons/wheat'
  import NutIcon from '@lucide/svelte/icons/nut'

  type Day = { iso: string; label: string; number: number }

  let {
    data,
    date,
    today,
    recentDays,
    dayTones,
    showDayStrip = true,
    totals,
    targets,
    caloriePercent,
    caloriesRemaining,
    calorieColor,
    onSelectDate,
    onEditMeal,
  }: {
    data: AppData
    date: string
    today: string
    recentDays: Day[]
    dayTones: Record<string, string>
    showDayStrip?: boolean
    totals: Nutrition
    targets: Nutrition
    caloriePercent: number
    caloriesRemaining: number
    calorieColor: string
    onSelectDate: (iso: string) => void
    onEditMeal: (id: string) => void
  } = $props()

  const displayNumber = roundForDisplay
</script>

<div id="summary-panel" role="tabpanel" aria-labelledby="summary-tab">
  <Card.Root>
    <Card.Content>
      {#if showDayStrip}
        <DayStrip {data} {date} {today} {recentDays} {dayTones} {onSelectDate} />
      {:else}
        <p class="text-center font-medium mb-3">
          {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      {/if}
      <div
        id="calorie-summary"
        class="stat-card flex items-center justify-between my-4 rounded-md bg-card p-4"
        role="img"
        aria-label={`${displayNumber(totals.calories)} of ${displayNumber(targets.calories)} kcal, ${caloriePercent}% of target`}
      >
        <div class="flex flex-col gap-1">
          <strong class="text-2xl">{displayNumber(totals.calories)} kcal</strong>
          <span class="text-muted-foreground"
            >{displayNumber(Math.abs(caloriesRemaining))} kcal {caloriesRemaining >= 0 ? 'left' : 'over'}</span
          >
        </div>
        <div
          class="relative flex aspect-square w-full max-w-22 flex-none items-center rounded-full text-center"
          style={`--calorie-progress: ${Math.min(caloriePercent, 100)}%; --calorie-color: ${calorieColor}; background: conic-gradient(var(--calorie-color) var(--calorie-progress), var(--muted) 0)`}
          aria-hidden="true"
        >
          <div class="absolute inset-2 rounded-full bg-card flex items-center justify-center">
            <FlameIcon aria-hidden="true" class="size-6" style={`color: ${calorieColor}`} />
          </div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2" aria-label="Macronutrient totals">
        <div class="stat-card grid gap-1 rounded-md bg-card p-2.5 text-center">
          <span class="flex items-center justify-center gap-1 text-muted-foreground"
            ><HamIcon aria-hidden="true" class="size-4" /> Protein</span
          ><strong>{Math.round(totals.protein)} / {Math.round(targets.protein)}</strong>
        </div>
        <div class="stat-card grid gap-1 rounded-md bg-card p-2.5 text-center">
          <span class="flex items-center justify-center gap-1 text-muted-foreground"
            ><WheatIcon aria-hidden="true" class="size-4" /> Carbs</span
          ><strong>{Math.round(totals.carbohydrates)} / {Math.round(targets.carbohydrates)}</strong>
        </div>
        <div class="stat-card grid gap-1 rounded-md bg-card p-2.5 text-center">
          <span class="flex items-center justify-center gap-1 text-muted-foreground"
            ><NutIcon aria-hidden="true" class="size-4" /> Fat</span
          ><strong>{Math.round(totals.fat)} / {Math.round(targets.fat)}</strong>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <div>
    <Separator class="mb-4" />
    <div>
      <div class="meal-list">
        {#each data.mealEntries
          .filter((entry) => entry.date === date)
          .sort((a, b) => a.time.localeCompare(b.time)) as entry (entry.id)}
          {@const food = data.foods.find((item) => item.id === entry.foodId)}
          {@const mealName = food?.name.en ?? entry.foodName ?? 'Food'}
          <button
            type="button"
            class="meal-card"
            aria-label={`${entry.time}, ${mealName}, ${displayNumber(entry.nutrition.calories)} kcal. Edit meal.`}
            onclick={() => onEditMeal(entry.id)}
          >
            <div class="flex items-center justify-between">
              <span>{mealName}</span>
              <time datetime={`${entry.date}T${entry.time}`} class="text-muted-foreground text-sm">{entry.time}</time>
            </div>
            <strong class="text-lg leading-[1.1]">{displayNumber(entry.nutrition.calories)} kcal</strong>
            <span class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1 text-muted-foreground">
                <span class="text-xs"><HamIcon aria-hidden="true" class="size-4" /> </span>
                <strong class="text-sm font-normal">{displayNumber(entry.nutrition.protein)} g</strong>
              </div>
              <div class="flex items-center gap-1 text-muted-foreground">
                <span class="text-xs"><WheatIcon aria-hidden="true" class="size-4" /></span>
                <strong class="text-sm font-normal">{displayNumber(entry.nutrition.carbohydrates)} g</strong>
              </div>
              <div class="flex items-center gap-1 text-muted-foreground">
                <span class="text-xs"><NutIcon aria-hidden="true" class="size-4" /> </span>
                <strong class="text-sm font-normal">{displayNumber(entry.nutrition.fat)} g</strong>
              </div>
            </span>
          </button>
        {:else}
          <p>No meals recorded today.</p>
        {/each}
      </div>
    </div>
  </div>
</div>
