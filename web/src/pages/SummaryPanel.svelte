<script lang="ts">
  import { roundForDisplay, type AppData, type Nutrition } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'
  import DayStrip from './DayStrip.svelte'
  import DumbbellIcon from '@lucide/svelte/icons/dumbbell'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import XIcon from '@lucide/svelte/icons/x'
  import FlameIcon from '@lucide/svelte/icons/flame'
  import HamIcon from '@lucide/svelte/icons/ham'
  import WheatIcon from '@lucide/svelte/icons/wheat'
  import NutIcon from '@lucide/svelte/icons/nut'
  import { foodName, formatDate, t } from '../lib/i18n.svelte'

  type Day = { iso: string; number: number }

  let {
    data,
    date,
    today,
    recentDays,
    dayTones,
    showDayStrip = true,
    totals,
    targets,
    exerciseCalories,
    calorieTarget,
    caloriePercent,
    caloriesRemaining,
    calorieColor,
    onSelectDate,
    onEditMeal,
    onSaveExerciseCalories,
  }: {
    data: AppData
    date: string
    today: string
    recentDays: Day[]
    dayTones: Record<string, string>
    showDayStrip?: boolean
    totals: Nutrition
    targets: Nutrition
    exerciseCalories: number
    calorieTarget: number
    caloriePercent: number
    caloriesRemaining: number
    calorieColor: string
    onSelectDate: (iso: string) => void
    onEditMeal: (id: string) => void
    onSaveExerciseCalories: (calories: number) => void
  } = $props()

  const displayNumber = roundForDisplay
  let exerciseInput: number | undefined = $state()
  let exerciseDialogOpen = $state(false)
  $effect(() => {
    exerciseInput = exerciseCalories || undefined
  })
  function openExerciseEditor() {
    exerciseInput = exerciseCalories || undefined
    exerciseDialogOpen = true
  }
  // ponytail: macro alert threshold (120%) is intentionally looser than the calorie tone's 110%; own constant, not reused.
  const isOverMacro = (amount: number, target: number) => target > 0 && amount / target > 1.2
</script>

<div id="summary-panel" role="tabpanel" aria-labelledby="summary-tab">
  <Card.Root>
    <Card.Content>
      {#if showDayStrip}
        <DayStrip {data} {date} {today} {recentDays} {dayTones} {onSelectDate} />
      {:else}
        <p class="text-center font-medium mb-3">
          {formatDate(date, {
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
        aria-label={`${displayNumber(totals.calories)} ${t('of')} ${displayNumber(calorieTarget)} kcal, ${caloriePercent}% ${t('ofTarget')}`}
      >
        <div class="flex flex-col gap-1">
          <strong class="text-2xl">{displayNumber(totals.calories)} kcal</strong>
          <span class="text-muted-foreground"
            >{displayNumber(Math.abs(caloriesRemaining))} kcal {caloriesRemaining >= 0
              ? t('caloriesLeft')
              : t('caloriesOver')}</span
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
      <div class="grid grid-cols-3 gap-2" aria-label={t('macronutrientTotals')}>
        <div class="stat-card grid gap-1 rounded-md bg-card p-2.5 text-center">
          <span class="flex items-center justify-center gap-1 text-muted-foreground"
            ><HamIcon aria-hidden="true" class="size-4" /> {t('proteinShort')}</span
          ><strong class:text-[var(--macro-over)]={isOverMacro(totals.protein, targets.protein)}
            >{Math.round(totals.protein)} / {Math.round(targets.protein)}</strong
          >
        </div>
        <div class="stat-card grid gap-1 rounded-md bg-card p-2.5 text-center">
          <span class="flex items-center justify-center gap-1 text-muted-foreground"
            ><WheatIcon aria-hidden="true" class="size-4" /> {t('carbs')}</span
          ><strong class:text-[var(--macro-over)]={isOverMacro(totals.carbohydrates, targets.carbohydrates)}
            >{Math.round(totals.carbohydrates)} / {Math.round(targets.carbohydrates)}</strong
          >
        </div>
        <div class="stat-card grid gap-1 rounded-md bg-card p-2.5 text-center">
          <span class="flex items-center justify-center gap-1 text-muted-foreground"
            ><NutIcon aria-hidden="true" class="size-4" /> {t('fat')}</span
          ><strong class:text-[var(--macro-over)]={isOverMacro(totals.fat, targets.fat)}
            >{Math.round(totals.fat)} / {Math.round(targets.fat)}</strong
          >
        </div>
      </div>
      <button
        type="button"
        class="mt-3 flex w-full items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted"
        aria-label={t('exerciseCalories')}
        onclick={openExerciseEditor}
      >
        <span class="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
          <DumbbellIcon aria-hidden="true" class="size-4" />
        </span>
        <span class="min-w-0 flex-1 text-sm">
          {t('exerciseCalories')}
          {#if exerciseCalories > 0}
            <span class="ml-1 font-medium text-foreground">+{displayNumber(exerciseCalories)}</span>
          {/if}
        </span>
        <ChevronRightIcon aria-hidden="true" class="size-4 text-muted-foreground" />
      </button>
      <Dialog.Root bind:open={exerciseDialogOpen}>
        <Dialog.Content class="top-[30%]">
          <Dialog.Header>
            <Dialog.Title>{t('exerciseCalories')}</Dialog.Title>
          </Dialog.Header>
          <form
            class="grid gap-3"
            onsubmit={(event) => {
              event.preventDefault()
              onSaveExerciseCalories(exerciseInput ?? 0)
              exerciseDialogOpen = false
            }}
          >
            <label class="grid gap-1 text-sm" for="exercise-calories">
              {t('calories')}
              <span class="relative">
                <Input
                  id="exercise-calories"
                  class="pr-9"
                  type="number"
                  min="0"
                  step="1"
                  autofocus
                  bind:value={exerciseInput}
                />
                <Button
                  class="absolute top-0 right-0"
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={t('clear')}
                  onclick={() => (exerciseInput = undefined)}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </span>
            </label>
            <Button class="w-full" type="submit">{t('saveExerciseCalories')}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Root>
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
          {@const mealName = food ? foodName(food.name) : (entry.foodName ?? t('food'))}
          <button
            type="button"
            class="grid w-full cursor-pointer gap-1 rounded-md border bg-muted/40 px-4 py-3 text-left text-[inherit] font-[inherit] shadow-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`${entry.time}, ${mealName}, ${displayNumber(entry.nutrition.calories)} kcal. ${t('editMeal')}.`}
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
          <p>{t('noMealsRecordedToday')}</p>
        {/each}
      </div>
    </div>
  </div>
</div>
