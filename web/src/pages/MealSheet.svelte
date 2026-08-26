<script lang="ts">
  import {
    createMealEntry,
    createTemporaryMealEntry,
    roundForDisplay,
    searchFoods,
    toggleFavoriteFood,
    updateMealEntry,
    type AppData,
    type Food,
  } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as AlertDialog from '$lib/components/ui/alert-dialog'
  import { swipeBack } from '$lib/actions/swipe-back'
  import NavCircleButton from '$lib/components/nav-circle-button.svelte'
  import SwipeLayer from '$lib/components/swipe-layer.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import MinusIcon from '@lucide/svelte/icons/minus'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import StarIcon from '@lucide/svelte/icons/star'
  import XIcon from '@lucide/svelte/icons/x'
  import type { Snippet } from 'svelte'
  import { foodName, t, translate } from '../lib/i18n.svelte'

  let {
    data,
    date = $bindable(),
    today,
    onSave,
    onCreateFood,
    onDelete,
  }: {
    data: AppData
    date: string
    today: string
    onSave: (next: AppData) => Promise<void>
    onCreateFood: (name: string) => void
    onDelete: (id: string) => Promise<void>
  } = $props()

  const displayNumber = roundForDisplay

  let open = $state(false)
  let editingMealId = $state('')
  let time = $state(new Date().toTimeString().slice(0, 5))
  let quantity = $state(1)
  let error = $state('')

  // Non-temporary (food-based) flow: a two-step wizard — search for a food, then
  // pick one to move to a details step with quantity/time and the record button.
  let step: 'search' | 'detail' = $state('search')
  let foodSearch = $state('')
  let selectedFoodId = $state('')
  const selectedFood = $derived(data.foods.find((food) => food.id === selectedFoodId) ?? null)

  // Filter is live on input; results are paginated on scroll rather than all rendered at once.
  const FOOD_PAGE_SIZE = 20
  let foodPage = $state(1)
  const favoriteFoodIds = $derived(data.favoriteFoodIds ?? [])
  const matchingFoods = $derived(searchFoods(data.foods, foodSearch, favoriteFoodIds))
  const foodResults = $derived(matchingFoods.slice(0, foodPage * FOOD_PAGE_SIZE))
  const isFavorite = (id: string) => favoriteFoodIds.includes(id)
  function toggleFavorite(id: string) {
    void onSave(toggleFavoriteFood(data, id))
  }
  const creatingMealFood = $derived(foodSearch.trim() !== '' && matchingFoods.length === 0)

  // Tracks an in-flight "Add food" request from the search step. `creatingMealFood`
  // itself can't be used to gate notifyFoodSaved: by the time it runs, the new food
  // is already in `data`, so `matchingFoods` matches it and `creatingMealFood` has
  // already flipped back to false.
  let awaitingCreatedFood = $state(false)

  function handleResultsScroll(event: Event) {
    const el = event.currentTarget as HTMLElement
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) foodPage += 1
  }

  function defaultTemporaryName() {
    return translate('other')
  }

  let temporaryMeal = $state(false)
  let temporaryName = $state(defaultTemporaryName())
  let temporaryCalories = $state(0)
  let temporaryProtein = $state(0)
  let temporaryFat = $state(0)
  let temporaryCarbohydrates = $state(0)

  export function openForNew() {
    editingMealId = ''
    selectedFoodId = ''
    foodSearch = ''
    foodPage = 1
    temporaryMeal = false
    step = 'search'
    date = today
    time = new Date().toTimeString().slice(0, 5)
    quantity = 1
    error = ''
    awaitingCreatedFood = false
    open = true
  }

  export function openForEdit(id: string) {
    const entry = data.mealEntries.find((item) => item.id === id)
    if (!entry) return
    editingMealId = id
    date = entry.date
    time = entry.time
    error = ''
    awaitingCreatedFood = false
    if (entry.foodId === '') {
      temporaryMeal = true
      temporaryName = entry.foodName ?? defaultTemporaryName()
      ;({
        calories: temporaryCalories,
        protein: temporaryProtein,
        fat: temporaryFat,
        carbohydrates: temporaryCarbohydrates,
      } = entry.nutrition)
    } else {
      temporaryMeal = false
      selectedFoodId = entry.foodId
      foodSearch = foodName(data.foods.find((food) => food.id === entry.foodId)?.name ?? {})
      foodPage = 1
      quantity = entry.quantity
      step = 'detail'
    }
    open = true
  }

  export function openTemporary() {
    editingMealId = ''
    temporaryMeal = true
    temporaryName = defaultTemporaryName()
    temporaryCalories = 0
    temporaryProtein = 0
    temporaryFat = 0
    temporaryCarbohydrates = 0
    date = today
    time = new Date().toTimeString().slice(0, 5)
    error = ''
    awaitingCreatedFood = false
    open = true
  }

  // Called after a food is created from the FoodSheet; only relevant if that
  // creation was triggered from this component's own "no match" search state.
  export function notifyFoodSaved(food: Food) {
    if (!awaitingCreatedFood) return
    awaitingCreatedFood = false
    selectedFoodId = food.id
    foodSearch = foodName(food.name)
    step = 'detail'
  }

  let confirmingDelete = $state(false)

  // ponytail: plain fixed-page overlay instead of a dialog primitive — this page
  // always covers the full viewport, so there's no focus trap / outside-click
  // surface to manage, just a scroll lock while it's open.
  $effect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  })

  function close() {
    open = false
  }

  // The detail step reached from search (not from editing an existing meal) has
  // its own "back" destination — the search step — instead of closing the sheet.
  // Plain function (not $derived) — tsgo mis-narrows the 'detail' literal comparison
  // when it lives in a module-level $derived here.
  function showingSearchDetail() {
    return !temporaryMeal && step === 'detail' && !editingMealId
  }

  function backToSearch() {
    step = 'search'
    selectedFoodId = ''
  }

  async function handleDelete() {
    if (!editingMealId) return
    try {
      await onDelete(editingMealId)
      editingMealId = ''
      confirmingDelete = false
      open = false
    } catch (cause) {
      error = cause instanceof Error ? cause.message : translate('unableDeleteMeal')
    }
  }

  function chooseFoodResult(id: string) {
    selectedFoodId = id
    step = 'detail'
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (temporaryMeal) {
      try {
        const temporary = createTemporaryMealEntry({
          id: editingMealId || undefined,
          date,
          time,
          quantity: 1,
          foodName: temporaryName,
          nutrition: {
            calories: temporaryCalories,
            protein: temporaryProtein,
            fat: temporaryFat,
            carbohydrates: temporaryCarbohydrates,
          },
        })
        const saved = editingMealId
          ? updateMealEntry(data, editingMealId, temporary)
          : { ...data, mealEntries: [...data.mealEntries, temporary] }
        await onSave(saved)
        editingMealId = ''
        temporaryMeal = false
        open = false
      } catch (cause) {
        error = cause instanceof Error ? cause.message : translate('unableRecordCalories')
      }
      return
    }
    const food = selectedFood
    if (!food) {
      error = translate('searchForFoodFirst')
      return
    }
    try {
      const saved = editingMealId
        ? updateMealEntry(data, editingMealId, { date, time, foodId: food.id, quantity })
        : {
            ...data,
            mealEntries: [...data.mealEntries, createMealEntry({ date, time, foodId: food.id, quantity }, food)],
          }
      await onSave(saved)
      editingMealId = ''
      temporaryMeal = false
      open = false
    } catch (cause) {
      error = cause instanceof Error ? cause.message : translate('unableRecordMeal')
    }
  }
</script>

{#snippet closeControl()}
  <NavCircleButton label={t('close')} onclick={close}>
    <XIcon aria-hidden="true" class="size-5" />
  </NavCircleButton>
{/snippet}

{#snippet backToSearchControl()}
  <NavCircleButton label={t('backToSearch')} onclick={backToSearch}>
    <ChevronLeftIcon aria-hidden="true" class="size-5" />
  </NavCircleButton>
{/snippet}

{#snippet screenHeader(title: string, description: string, control: Snippet)}
  <div class="flex items-start justify-between gap-4 py-6 px-3 pb-0">
    <div class="flex flex-col gap-1.5">
      <h2 class="font-heading text-base font-medium text-foreground">{title}</h2>
      <p class="text-sm text-muted-foreground">{description}</p>
    </div>
    {@render control()}
  </div>
{/snippet}

{#snippet temporaryScreen()}
  <div class="flex h-full flex-col bg-popover">
    {@render screenHeader(
      editingMealId ? t('editMeal') : t('quickAdd'),
      t('recordNutritionWithoutSavingFood'),
      closeControl,
    )}
    <div class="flex-1 overflow-y-auto px-3 py-4">
      <form class="grid gap-4" onsubmit={handleSubmit} novalidate>
        <div class="grid gap-2">
          <Label for="temporary-title">{t('name')}</Label>
          <Input id="temporary-title" bind:value={temporaryName} required />
        </div>
        <div class="grid gap-2">
          <Label for="temporary-calories">{t('calories')}</Label>
          <Input
            id="temporary-calories"
            type="number"
            min="0"
            value={temporaryCalories}
            oninput={(e) => (temporaryCalories = e.currentTarget.valueAsNumber || 0)}
          />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="grid gap-2">
            <Label for="temporary-protein">{t('protein')}</Label>
            <Input
              id="temporary-protein"
              type="number"
              min="0"
              step="0.1"
              value={temporaryProtein}
              oninput={(e) => (temporaryProtein = e.currentTarget.valueAsNumber || 0)}
            />
          </div>
          <div class="grid gap-2">
            <Label for="temporary-fat">{t('fat')}</Label>
            <Input
              id="temporary-fat"
              type="number"
              min="0"
              step="0.1"
              value={temporaryFat}
              oninput={(e) => (temporaryFat = e.currentTarget.valueAsNumber || 0)}
            />
          </div>
          <div class="grid gap-2">
            <Label for="temporary-carbohydrates">{t('carbs')}</Label>
            <Input
              id="temporary-carbohydrates"
              type="number"
              min="0"
              step="0.1"
              value={temporaryCarbohydrates}
              oninput={(e) => (temporaryCarbohydrates = e.currentTarget.valueAsNumber || 0)}
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-2">
            <Label for="meal-date">{t('date')}</Label>
            <Input id="meal-date" type="date" max={today} bind:value={date} required />
          </div>
          <div class="grid gap-2">
            <Label for="meal-time">{t('time')}</Label>
            <Input id="meal-time" type="time" step="600" bind:value={time} required />
          </div>
        </div>
        {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
        <Button type="submit">{editingMealId ? t('updateMeal') : t('addMeal')}</Button>
        {#if editingMealId}
          <Button type="button" variant="destructive" class="w-full" onclick={() => (confirmingDelete = true)}
            >{t('deleteMeal')}</Button
          >
        {/if}
      </form>
    </div>
  </div>
{/snippet}

{#snippet searchScreen()}
  <div class="flex h-full flex-col bg-popover">
    {@render screenHeader(editingMealId ? t('editMeal') : t('recordAMeal'), t('searchForFoodToRecord'), closeControl)}
    <div class="flex-1 overflow-y-auto px-3 pb-6" onscroll={handleResultsScroll}>
      <div class="grid gap-4">
        <div class="flex flex-col gap-2 py-2">
          <Input
            class="min-w-0"
            bind:value={foodSearch}
            oninput={() => {
              selectedFoodId = ''
              foodPage = 1
            }}
            placeholder={t('searchFood')}
            aria-label={t('searchFood')}
            required
          />
          <Button
            type="button"
            variant="outline"
            onclick={() => {
              selectedFoodId = ''
              foodPage = 1
            }}>{t('search')}</Button
          >
        </div>
        {#if creatingMealFood}
          <span role="status" class="text-muted-foreground">{t('noMatchAddDetails')}</span>
        {/if}
        {#if foodResults.length > 0}
          <div class="meal-list">
            {#each foodResults as food}
              <Button
                type="button"
                variant="secondary"
                class="h-auto w-full min-w-0 flex-col items-stretch gap-0.5 rounded-2xl p-4 text-left whitespace-normal"
                onclick={() => chooseFoodResult(food.id)}
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="min-w-0 truncate font-semibold">{foodName(food.name)}</span>
                  <span class="shrink-0 font-semibold whitespace-nowrap"
                    >{displayNumber(food.nutrition.calories)} kcal</span
                  >
                </div>
                {#if food.description}<span class="meal-card-topline">{food.description}</span>{/if}
                <div class="flex items-center justify-between gap-2">
                  <span class="meal-card-topline">{food.serving}</span>
                  {#if isFavorite(food.id)}
                    <StarIcon aria-hidden="true" class="size-4 shrink-0 fill-yellow-400 text-yellow-400" />
                  {/if}
                </div>
              </Button>
            {/each}
          </div>
        {/if}
        {#if creatingMealFood}
          <Button
            type="button"
            variant="outline"
            onclick={() => {
              awaitingCreatedFood = true
              onCreateFood(foodSearch.trim())
            }}>{t('addFood')}</Button
          >
        {/if}
      </div>
    </div>
  </div>
{/snippet}

{#snippet detailScreen(control: Snippet)}
  <div class="flex h-full flex-col bg-popover">
    {@render screenHeader(
      editingMealId ? t('editMeal') : t('mealDetails'),
      t('setTimeAndQuantityForThisMeal'),
      control,
    )}
    <div class="flex-1 overflow-y-auto px-3 py-6">
      {#if selectedFood}
        <form class="grid gap-4" onsubmit={handleSubmit} novalidate>
          <div class="grid gap-1">
            <div class="flex items-start justify-between gap-4">
              <h3 class="text-lg font-semibold">{foodName(selectedFood.name)}</h3>
              <span class="shrink-0 text-lg font-semibold whitespace-nowrap"
                >{displayNumber(selectedFood.nutrition.calories)} kcal</span
              >
            </div>
            {#if selectedFood.description}
              <p class="text-sm text-muted-foreground">{selectedFood.description}</p>
            {/if}
            <div class="flex items-center justify-between gap-4">
              <p class="text-sm text-muted-foreground">{selectedFood.serving}</p>
              <button
                type="button"
                class="flex shrink-0 items-center leading-none text-muted-foreground"
                aria-label={isFavorite(selectedFood.id) ? t('removeFromFavorites') : t('addToFavorites')}
                aria-pressed={isFavorite(selectedFood.id)}
                onclick={() => toggleFavorite(selectedFood.id)}
              >
                <StarIcon
                  aria-hidden="true"
                  class={`size-5 ${isFavorite(selectedFood.id) ? 'fill-yellow-400 text-yellow-400' : ''}`}
                />
              </button>
            </div>
            <p class="mt-2 flex gap-4 text-sm text-muted-foreground">
              <span>{displayNumber(selectedFood.nutrition.protein)} g {t('protein').toLowerCase()}</span>
              <span>{displayNumber(selectedFood.nutrition.fat)} g {t('fat').toLowerCase()}</span>
              <span>{displayNumber(selectedFood.nutrition.carbohydrates)} g {t('carbs').toLowerCase()}</span>
            </p>
          </div>

          <div class="grid gap-2">
            <Label for="meal-quantity">{t('quantity')}</Label>
            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('decreaseQuantity')}
                onclick={() => (quantity = Math.max(1, quantity - 1))}><MinusIcon aria-hidden="true" /></Button
              >
              <Input
                id="meal-quantity"
                class="text-center"
                type="number"
                min="1"
                step="1"
                bind:value={quantity}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('increaseQuantity')}
                onclick={() => (quantity = quantity + 1)}><PlusIcon aria-hidden="true" /></Button
              >
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-2">
              <Label for="meal-date">{t('date')}</Label>
              <Input id="meal-date" type="date" max={today} bind:value={date} required />
            </div>
            <div class="grid gap-2">
              <Label for="meal-time">{t('time')}</Label>
              <Input id="meal-time" type="time" step="600" bind:value={time} required />
            </div>
          </div>
          {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
          <Button type="submit">{editingMealId ? t('updateMeal') : t('addMeal')}</Button>
          {#if editingMealId}
            <Button type="button" variant="destructive" class="w-full" onclick={() => (confirmingDelete = true)}
              >{t('deleteMeal')}</Button
            >
          {/if}
        </form>
      {/if}
    </div>
  </div>
{/snippet}

{#if open}
  <div
    class="fixed inset-0 z-50 text-sm text-popover-foreground [touch-action:pan-y]"
    role="dialog"
    aria-modal="true"
    aria-label={temporaryMeal
      ? editingMealId
        ? t('editMeal')
        : t('quickAdd')
      : step === 'detail'
        ? editingMealId
          ? t('editMeal')
          : t('mealDetails')
        : editingMealId
          ? t('editMeal')
          : t('recordAMeal')}
    use:swipeBack={{ onBack: showingSearchDetail() ? () => {} : close, drag: !showingSearchDetail() }}
  >
    {#if temporaryMeal}
      {@render temporaryScreen()}
    {:else if showingSearchDetail()}
      <SwipeLayer onBack={backToSearch}>
        {#snippet back()}
          {@render searchScreen()}
        {/snippet}
        {#snippet front()}
          {@render detailScreen(backToSearchControl)}
        {/snippet}
      </SwipeLayer>
    {:else if step === 'search'}
      {@render searchScreen()}
    {:else if selectedFood}
      {@render detailScreen(closeControl)}
    {/if}
  </div>
{/if}

<AlertDialog.Root bind:open={confirmingDelete}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{t('deleteThisMeal')}</AlertDialog.Title>
      <AlertDialog.Description>{t('thisCannotBeUndone')}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{t('cancel')}</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={handleDelete}>{t('delete')}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
