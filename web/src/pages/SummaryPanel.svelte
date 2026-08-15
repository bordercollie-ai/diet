<script lang="ts">
  import { dailyTotals, roundForDisplay, type AppData, type Nutrition } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'
  import PlusIcon from '@lucide/svelte/icons/plus'
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
    totals,
    targets,
    caloriePercent,
    caloriesRemaining,
    calorieColor,
    onSelectDate,
    onEditMeal,
    onRecordMeal,
    onQuickAdd,
  }: {
    data: AppData
    date: string
    today: string
    recentDays: Day[]
    dayTones: Record<string, string>
    totals: Nutrition
    targets: Nutrition
    caloriePercent: number
    caloriesRemaining: number
    calorieColor: string
    onSelectDate: (iso: string) => void
    onEditMeal: (id: string) => void
    onRecordMeal: () => void
    onQuickAdd: () => void
  } = $props()

  const displayNumber = roundForDisplay
</script>

<div id="summary-panel" role="tabpanel" aria-labelledby="summary-tab">
  <Card.Root>
    <Card.Content>
      <div class="day-strip" aria-label="Recent days">
        {#each recentDays as day}
          {@const dayCalories = dailyTotals(data, day.iso).calories}
          {@const tone = dayTones[day.iso]}
          <button
            type="button"
            class:selected={date === day.iso}
            class:font-bold={day.iso === today}
            class:under={tone === 'under'}
            class:on-target={tone === 'on-target'}
            class:over={tone === 'over'}
            class:empty={tone === 'empty'}
            aria-pressed={date === day.iso}
            aria-label={`${day.label} ${day.number}, ${displayNumber(dayCalories)} kcal`}
            onclick={() => onSelectDate(day.iso)}
          >
            <span class="day-label">{day.label}</span>
            <span
              class="flex aspect-square w-[min(2rem,100%)] items-center justify-center rounded-full border"
              class:border-dashed={tone === 'empty'}
              class:border-2={tone !== 'empty'}
              class:border-solid={tone !== 'empty' || day.iso === today}
              class:border-[var(--muted-foreground)]={tone === 'empty'}
              class:border-[var(--calorie-under)]={tone === 'under' || tone === 'on-target'}
              class:border-[var(--calorie-over)]={tone === 'over'}
              aria-hidden="true"><span>{day.number}</span></span
            >
          </button>
        {/each}
      </div>
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
              <span class="meal-name">{mealName}</span>
              <time datetime={`${entry.date}T${entry.time}`} class="text-muted-foreground text-sm">{entry.time}</time>
            </div>
            <strong class="text-xl leading-[1.1]">{displayNumber(entry.nutrition.calories)} kcal</strong>
            <span class="grid grid-cols-3 gap-2">
              <span class="grid gap-0.5"
                ><span class="meal-macro-label"><HamIcon aria-hidden="true" class="size-3.5" /> Protein</span><strong
                  class="text-sm font-normal">{displayNumber(entry.nutrition.protein)} g</strong
                ></span
              >
              <span class="grid gap-0.5"
                ><span class="meal-macro-label"><WheatIcon aria-hidden="true" class="size-3.5" /> Carbs</span><strong
                  class="text-sm font-normal">{displayNumber(entry.nutrition.carbohydrates)} g</strong
                ></span
              >
              <span class="grid gap-0.5"
                ><span class="meal-macro-label"><NutIcon aria-hidden="true" class="size-3.5" /> Fat</span><strong
                  class="text-sm font-normal">{displayNumber(entry.nutrition.fat)} g</strong
                ></span
              >
            </span>
          </button>
        {:else}
          <p>No meals recorded.</p>
        {/each}
      </div>
    </div>
  </div>
  <Button type="button" class="w-full mt-4" aria-haspopup="dialog" onclick={onRecordMeal}>
    <PlusIcon aria-hidden="true" />
    Add a meal
  </Button>
  <Button type="button" variant="outline" class="w-full" aria-haspopup="dialog" onclick={onQuickAdd}>Quick add</Button>
</div>
