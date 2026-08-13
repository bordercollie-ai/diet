<script lang="ts">
  import {
    createMealEntry,
    createTemporaryMealEntry,
    roundForDisplay,
    searchFoods,
    updateMealEntry,
    type AppData,
    type Food,
  } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Sheet from '$lib/components/ui/sheet'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import MinusIcon from '@lucide/svelte/icons/minus'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'

  let {
    data,
    date = $bindable(),
    onSave,
    onCreateFood,
  }: {
    data: AppData
    date: string
    onSave: (next: AppData) => Promise<void>
    onCreateFood: (name: string) => void
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
  let foodResults: Food[] = $state([])
  let foodSearchMessage = $state('')
  let creatingMealFood = $state(false)
  const selectedFood = $derived(data.foods.find((food) => food.id === selectedFoodId) ?? null)

  let temporaryMeal = $state(false)
  let temporaryName = $state('Quick entry')
  let temporaryCalories = $state(0)
  let temporaryProtein = $state(0)
  let temporaryFat = $state(0)
  let temporaryCarbohydrates = $state(0)

  export function openForNew() {
    editingMealId = ''
    selectedFoodId = ''
    foodSearch = ''
    foodResults = []
    creatingMealFood = false
    foodSearchMessage = ''
    temporaryMeal = false
    step = 'search'
    error = ''
    open = true
  }

  export function openForEdit(id: string) {
    const entry = data.mealEntries.find((item) => item.id === id)
    if (!entry) return
    editingMealId = id
    date = entry.date
    time = entry.time
    error = ''
    if (entry.foodId === '') {
      temporaryMeal = true
      temporaryName = entry.foodName ?? 'Quick entry'
      ;({
        calories: temporaryCalories,
        protein: temporaryProtein,
        fat: temporaryFat,
        carbohydrates: temporaryCarbohydrates,
      } = entry.nutrition)
    } else {
      temporaryMeal = false
      selectedFoodId = entry.foodId
      foodSearch = data.foods.find((food) => food.id === entry.foodId)?.name.en ?? ''
      foodResults = []
      creatingMealFood = false
      quantity = entry.quantity
      step = 'detail'
    }
    open = true
  }

  export function openTemporary() {
    editingMealId = ''
    temporaryMeal = true
    temporaryName = 'Quick entry'
    temporaryCalories = 0
    temporaryProtein = 0
    temporaryFat = 0
    temporaryCarbohydrates = 0
    error = ''
    open = true
  }

  // Called after a food is created from the FoodSheet; only relevant if that
  // creation was triggered from this component's own "no match" search state.
  export function notifyFoodSaved(food: Food) {
    if (!creatingMealFood) return
    selectedFoodId = food.id
    foodSearch = food.name.en ?? foodSearch
    creatingMealFood = false
    foodSearchMessage = ''
    step = 'detail'
  }

  function searchForFood() {
    const name = foodSearch.trim()
    if (!name) {
      foodSearchMessage = 'Enter a food name.'
      return
    }
    foodResults = searchFoods(data.foods, name)
    selectedFoodId = ''
    if (foodResults.length === 0) {
      creatingMealFood = true
      foodSearchMessage = 'No match. Add nutrition details to create it with this meal.'
    } else {
      creatingMealFood = false
      foodSearchMessage = ''
    }
  }

  function chooseFoodResult(id: string) {
    selectedFoodId = id
    step = 'detail'
  }

  function backToSearch() {
    step = 'search'
    selectedFoodId = ''
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
        error = cause instanceof Error ? cause.message : 'Unable to record calories.'
      }
      return
    }
    const food = selectedFood
    if (!food) {
      error = 'Search for a food first.'
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
      creatingMealFood = false
      foodSearchMessage = ''
      temporaryMeal = false
      open = false
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to record meal.'
    }
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content side="right" class="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none">
    <Sheet.Header>
      <Sheet.Title>
        {#if temporaryMeal}
          {editingMealId ? 'Edit meal' : 'Quick add'}
        {:else if step === 'detail'}
          {editingMealId ? 'Edit meal' : 'Meal details'}
        {:else}
          {editingMealId ? 'Edit meal' : 'Record a meal'}
        {/if}
      </Sheet.Title>
      <Sheet.Description>
        {#if temporaryMeal}
          Record nutrition without saving a food.
        {:else if step === 'detail'}
          Set the time and quantity, then record the meal.
        {:else}
          Search for a food to record.
        {/if}
      </Sheet.Description>
    </Sheet.Header>
    <div class="flex-1 overflow-y-auto px-6 pb-6">
      {#if temporaryMeal}
        <form class="grid gap-4" onsubmit={handleSubmit} novalidate>
          <div class="grid gap-2">
            <Label for="temporary-name">Name</Label>
            <Input id="temporary-name" bind:value={temporaryName} required />
          </div>
          <div class="grid gap-2">
            <Label for="temporary-calories">Calories</Label>
            <Input id="temporary-calories" type="number" min="0" bind:value={temporaryCalories} required />
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="grid gap-2">
              <Label for="temporary-protein">Protein</Label>
              <Input id="temporary-protein" type="number" min="0" step="0.1" bind:value={temporaryProtein} required />
            </div>
            <div class="grid gap-2">
              <Label for="temporary-fat">Fat</Label>
              <Input id="temporary-fat" type="number" min="0" step="0.1" bind:value={temporaryFat} required />
            </div>
            <div class="grid gap-2">
              <Label for="temporary-carbohydrates">Carbs</Label>
              <Input
                id="temporary-carbohydrates"
                type="number"
                min="0"
                step="0.1"
                bind:value={temporaryCarbohydrates}
                required
              />
            </div>
          </div>
          <div class="grid gap-2">
            <Label for="meal-time">Time</Label>
            <Input id="meal-time" type="time" step="600" bind:value={time} required />
          </div>
          {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
          <Button type="submit">{editingMealId ? 'Update meal' : 'Add meal'}</Button>
        </form>
      {:else if step === 'search'}
        <div class="grid gap-4">
          <label
            >Food
            <div class="flex flex-col gap-2">
              <Input
                class="min-w-0"
                bind:value={foodSearch}
                oninput={() => {
                  selectedFoodId = ''
                  foodResults = []
                  creatingMealFood = false
                  foodSearchMessage = ''
                }}
                onkeydown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  searchForFood()
                }}
                placeholder="Search food"
                aria-label="Search food"
                required
              />
              <Button type="button" variant="outline" onclick={searchForFood}>Search</Button>
            </div>
            {#if foodSearchMessage}<span role="status" class="text-muted-foreground">{foodSearchMessage}</span>{/if}
          </label>
          {#if foodResults.length > 0}
            <div class="meal-list">
              {#each foodResults as food}
                <button type="button" class="meal-card" onclick={() => chooseFoodResult(food.id)}>
                  <span class="meal-name">{food.name.en ?? Object.values(food.name)[0]}</span>
                  {#if food.description}<span class="meal-card-topline">{food.description}</span>{/if}
                  <strong class="meal-calories">{displayNumber(food.nutrition.calories)} kcal</strong>
                  <span class="meal-card-topline">{food.serving}</span>
                </button>
              {/each}
            </div>
          {/if}
          {#if creatingMealFood}
            <Button type="button" variant="outline" onclick={() => onCreateFood(foodSearch.trim())}>Add food</Button>
          {/if}
        </div>
      {:else if selectedFood}
        <form class="grid gap-4" onsubmit={handleSubmit} novalidate>
          {#if !editingMealId}
            <Button type="button" variant="ghost" class="-ml-2 w-fit justify-start" onclick={backToSearch}>
              <ChevronLeftIcon aria-hidden="true" />
              Back to search
            </Button>
          {/if}
          <div class="rounded-2xl bg-muted p-4">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold">{selectedFood.name.en ?? Object.values(selectedFood.name)[0]}</span>
              <span class="text-lg font-semibold">{displayNumber(selectedFood.nutrition.calories)} kcal</span>
            </div>
            {#if selectedFood.description}
              <p class="text-sm text-muted-foreground">{selectedFood.description}</p>
            {/if}
            <p class="text-sm text-muted-foreground">{selectedFood.serving}</p>
            <p class="mt-2 flex gap-4 text-sm text-muted-foreground">
              <span>{displayNumber(selectedFood.nutrition.protein)} g protein</span>
              <span>{displayNumber(selectedFood.nutrition.fat)} g fat</span>
              <span>{displayNumber(selectedFood.nutrition.carbohydrates)} g carbs</span>
            </p>
          </div>
          <div class="grid gap-2">
            <Label for="meal-time">Time</Label>
            <Input id="meal-time" type="time" step="600" bind:value={time} required />
          </div>
          <div class="grid gap-2">
            <Label for="meal-quantity">Quantity</Label>
            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Decrease quantity"
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
                aria-label="Increase quantity"
                onclick={() => (quantity = quantity + 1)}><PlusIcon aria-hidden="true" /></Button
              >
            </div>
          </div>
          {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
          <Button type="submit">{editingMealId ? 'Update meal' : 'Add meal'}</Button>
        </form>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
