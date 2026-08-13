<script lang="ts">
  import { onMount } from 'svelte'
  import {
    createMealEntry,
    createTemporaryMealEntry,
    bundledFoods,
    dailyTotals,
    deleteMealEntry,
    searchFoods,
    type AppData,
    type Food,
    type Profile,
    resolveTargets,
    estimateMaintenanceCalories,
    estimateTargets,
    previewBackup,
    roundForDisplay,
    updateMealEntry,
    type ImportResult,
  } from './domain/store'
  import { createIndexedDBStore } from './storage/indexeddb'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Sheet from '$lib/components/ui/sheet'
  import SummaryPanel from './pages/SummaryPanel.svelte'
  import FoodsPanel from './pages/FoodsPanel.svelte'
  import ProfilePanel from './pages/ProfilePanel.svelte'
  import BackupPanel from './pages/BackupPanel.svelte'
  import FoodSheet from './pages/FoodSheet.svelte'
  import { fade } from 'svelte/transition'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import MinusIcon from '@lucide/svelte/icons/minus'
  import ChartColumnIcon from '@lucide/svelte/icons/chart-column'
  import AppleIcon from '@lucide/svelte/icons/apple'
  import UserIcon from '@lucide/svelte/icons/user'
  import SaveIcon from '@lucide/svelte/icons/save'
  import SunIcon from '@lucide/svelte/icons/sun'
  import MoonIcon from '@lucide/svelte/icons/moon'

  const store = createIndexedDBStore()
  const today = new Date().toISOString().slice(0, 10)
  const defaultTargetDate = (() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 3)
    return date.toISOString().slice(0, 10)
  })()
  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${today}T12:00:00`)
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7) + index)
    return {
      iso: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString(undefined, { weekday: 'short' }),
      number: day.getDate(),
    }
  })
  let data: AppData = $state({ foods: [], mealEntries: [] })
  let date = $state(today)
  let foodSearch = $state('')
  let selectedFoodId = $state('')
  let foodResults: Food[] = $state([])
  let editingMealId = $state('')
  let time = $state(new Date().toTimeString().slice(0, 5))
  let quantity = $state(1)
  let foodSheet: {
    openForNew: () => void
    openForEdit: (food: Food) => void
    openWithName: (name: string) => void
  }
  let profile: Profile = $state({
    age: 30,
    sex: 'female',
    heightCm: 165,
    weightKg: 60,
    activity: 'moderate',
    targetWeightKg: 55,
    targetDate: defaultTargetDate,
  })
  let overrideCalories: number | undefined = $state()
  let overrideProtein: number | undefined = $state()
  let overrideFat: number | undefined = $state()
  let overrideCarbohydrates: number | undefined = $state()
  let status = $state('Loading local data...')
  let error = $state('')
  let backupText = $state('')
  let selectedBackupName = $state('')
  let toastMessage = $state('')
  let toastTimer: ReturnType<typeof setTimeout>

  function showToast(message: string) {
    toastMessage = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toastMessage = ''), 2500)
  }
  let backupPreview: ImportResult | null = $state(null)
  let installPrompt: BeforeInstallPromptEvent | null = $state(null)
  let installed = $state(false)
  let mealDialogOpen = $state(false)
  let creatingMealFood = $state(false)
  let foodSearchMessage = $state('')
  let temporaryMeal = $state(false)
  let temporaryName = $state('Quick entry')
  let temporaryCalories = $state(0)
  let temporaryProtein = $state(0)
  let temporaryFat = $state(0)
  let temporaryCarbohydrates = $state(0)
  let darkMode = $state(false)
  type Tab = 'summary' | 'foods' | 'profile' | 'backup'
  const tabs: { id: Tab; label: string; icon: typeof ChartColumnIcon }[] = [
    { id: 'summary', label: 'Summary', icon: ChartColumnIcon },
    { id: 'foods', label: 'Foods', icon: AppleIcon },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'backup', label: 'Backup', icon: SaveIcon },
  ]
  let activeTab: Tab = $state('summary')

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  const totals = $derived(dailyTotals(data, date))
  const displayNumber = roundForDisplay
  const profileReady = $derived(
    profile.age >= 1 &&
      profile.age <= 120 &&
      profile.heightCm >= 50 &&
      profile.heightCm <= 250 &&
      profile.weightKg >= 10 &&
      profile.weightKg <= 500 &&
      profile.targetWeightKg >= 10 &&
      profile.targetWeightKg <= 500 &&
      profile.targetDate > today,
  )
  const estimated = $derived(
    profileReady ? estimateTargets(profile, today) : { calories: 0, protein: 0, fat: 0, carbohydrates: 0 },
  )
  const maintenanceCalories = $derived(profileReady ? estimateMaintenanceCalories(profile) : 0)
  const targets = $derived(profileReady ? resolveTargets(profile, data.targetOverrides, today) : estimated)
  const calorieRatio = $derived(targets.calories > 0 ? totals.calories / targets.calories : 0)
  const caloriePercent = $derived(Math.round(calorieRatio * 100))
  const caloriesRemaining = $derived(targets.calories - totals.calories)
  const calorieTone = $derived(
    totals.calories === 0
      ? 'empty'
      : targets.calories === 0
        ? 'unavailable'
        : calorieRatio < 0.9
          ? 'under'
          : calorieRatio < 1.1
            ? 'on-target'
            : 'over',
  )
  const calorieColor = $derived(
    {
      under: 'var(--calorie-under)',
      'on-target': 'var(--calorie-under)',
      over: 'var(--calorie-over)',
      empty: 'var(--primary)',
      unavailable: 'var(--muted-foreground)',
    }[calorieTone],
  )

  onMount(async () => {
    darkMode =
      localStorage.getItem('diet-theme') === 'dark' ||
      (!localStorage.getItem('diet-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', darkMode)
    installed = window.matchMedia('(display-mode: standalone)').matches
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      installPrompt = event as BeforeInstallPromptEvent
    })

    window.addEventListener('appinstalled', () => {
      installed = true
      installPrompt = null
    })
    try {
      const loaded = await store.load()
      const mealEntries = loaded.mealEntries.map((entry) => ({
        ...entry,
        time: entry.time ?? '12:00',
      }))
      const { plans: _legacyPlans, ...withoutPlans } = loaded as AppData & { plans?: unknown }
      data = { ...withoutPlans, mealEntries }
      if (loaded.profile) {
        profile = {
          ...loaded.profile,
          targetWeightKg: loaded.profile.targetWeightKg ?? loaded.profile.weightKg,
          targetDate: loaded.profile.targetDate ?? defaultTargetDate,
        }
      }
      overrideCalories = loaded.targetOverrides?.calories
      overrideProtein = loaded.targetOverrides?.protein
      overrideFat = loaded.targetOverrides?.fat
      overrideCarbohydrates = loaded.targetOverrides?.carbohydrates
      // Always refresh bundled foods from the canonical bundledFoods source (never
      // trust the persisted copy) so field additions/edits — e.g. this description
      // field — reach installs that saved bundled records before the change shipped.
      // User-created foods are left untouched.
      const bundledIds = new Set(bundledFoods.map((food) => food.id))
      const userFoods = data.foods.filter((food) => !bundledIds.has(food.id))
      const foods = [...bundledFoods, ...userFoods]
      if (
        JSON.stringify(foods) !== JSON.stringify(data.foods) ||
        mealEntries.some((entry, index) => entry.time !== loaded.mealEntries[index].time)
      ) {
        data = { ...data, foods }
        await save(data)
      }
      status = 'Local data is ready.'
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to open local data.'
    }
  })

  function toggleTheme() {
    darkMode = !darkMode
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('diet-theme', darkMode ? 'dark' : 'light')
  }

  async function exportBackup() {
    try {
      const blob = new Blob([await store.export()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `diet-backup-${today}.json`
      link.click()
      URL.revokeObjectURL(url)
      status = 'Backup exported.'
      error = ''
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to export backup.'
    }
  }

  async function selectBackup(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      selectedBackupName = file.name
      backupText = await file.text()
      backupPreview = previewBackup(backupText)
      error = ''
    } catch (cause) {
      backupText = ''
      selectedBackupName = ''
      backupPreview = null
      error = cause instanceof Error ? cause.message : 'Unable to read backup.'
    } finally {
      input.value = ''
    }
  }

  async function restoreBackup() {
    if (!backupText) return
    try {
      const result = await store.import(backupText)
      data = result.data
      backupText = ''
      backupPreview = null
      status = 'Backup restored.'
      error = ''
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to restore backup.'
    }
  }

  async function installApp() {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      installPrompt = null
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to start installation.'
    }
  }

  async function save(next: AppData) {
    try {
      // ponytail: $state proxies aren't structured-cloneable; snapshot before persisting.
      const saved = $state.snapshot(next)
      await store.save(saved)
      data = saved
      error = ''
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to save local data.'
    }
  }

  function handleFoodSaved(food: Food) {
    selectedFoodId = food.id
    if (creatingMealFood) {
      foodSearch = food.name.en ?? foodSearch
      creatingMealFood = false
      foodSearchMessage = ''
    }
  }

  function handleFoodError(message: string) {
    error = message
  }

  async function addMeal(event: SubmitEvent) {
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
        await save(saved)
        editingMealId = ''
        temporaryMeal = false
        mealDialogOpen = false
      } catch (cause) {
        error = cause instanceof Error ? cause.message : 'Unable to record calories.'
      }
      return
    }
    const food = data.foods.find((item) => item.id === selectedFoodId)
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
      await save(saved)
      editingMealId = ''
      creatingMealFood = false
      foodSearchMessage = ''
      temporaryMeal = false
      mealDialogOpen = false
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to record meal.'
    }
  }

  async function removeMeal(id: string) {
    await save(deleteMealEntry(data, id))
  }

  async function saveProfile(event: SubmitEvent) {
    event.preventDefault()
    try {
      const targetOverrides = Object.fromEntries(
        [
          ['calories', overrideCalories],
          ['protein', overrideProtein],
          ['fat', overrideFat],
          ['carbohydrates', overrideCarbohydrates],
        ].filter(([, value]) => value !== undefined),
      )
      resolveTargets(profile, targetOverrides)
      await save({ ...data, profile, targetOverrides })
      showToast('Profile saved.')
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to save profile.'
    }
  }

  function editFood(id: string) {
    const food = data.foods.find((item) => item.id === id)
    if (!food || food.source === 'bundled') return
    foodSheet.openForEdit(food)
  }

  function startNewFood() {
    foodSheet.openForNew()
  }

  function addFoodFromMealSearch() {
    foodSheet.openWithName(foodSearch.trim())
  }

  function editMeal(id: string) {
    const entry = data.mealEntries.find((item) => item.id === id)
    if (!entry) return
    editingMealId = id
    date = entry.date
    time = entry.time
    selectedFoodId = entry.foodId
    foodSearch = data.foods.find((food) => food.id === entry.foodId)?.name.en ?? ''
    foodResults = []
    creatingMealFood = false
    temporaryMeal = entry.foodId === ''
    temporaryName = entry.foodName ?? 'Quick entry'
    ;({
      calories: temporaryCalories,
      protein: temporaryProtein,
      fat: temporaryFat,
      carbohydrates: temporaryCarbohydrates,
    } = entry.nutrition)
    quantity = entry.quantity
    error = ''
    mealDialogOpen = true
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
  }

  function startNewMeal() {
    editingMealId = ''
    selectedFoodId = ''
    foodSearch = ''
    foodResults = []
    creatingMealFood = false
    temporaryMeal = false
    foodSearchMessage = ''
    error = ''
    mealDialogOpen = true
  }

  function startTemporaryMeal() {
    editingMealId = ''
    temporaryMeal = true
    temporaryName = 'Quick entry'
    temporaryCalories = 0
    temporaryProtein = 0
    temporaryFat = 0
    temporaryCarbohydrates = 0
    error = ''
    mealDialogOpen = true
  }

  function dayTone(iso: string) {
    const dayCalories = dailyTotals(data, iso).calories
    if (dayCalories === 0) return 'empty'
    if (targets.calories === 0) return 'unavailable'
    const ratio = dayCalories / targets.calories
    return ratio < 0.9 ? 'under' : ratio < 1.1 ? 'on-target' : 'over'
  }
  const dayTones = $derived(Object.fromEntries(recentDays.map((day) => [day.iso, dayTone(day.iso)])))
</script>

<svelte:head>
  <title>Diet</title>
  <meta name="theme-color" content="#ffffff" />
  <link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<main
  class="max-w-3xl mx-auto px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]"
>
  <header class="flex items-center justify-between gap-4 mb-2">
    <div>
      <h1 class="m-0 text-2xl">Diet</h1>
      <p class="sr-only" role="status" aria-live="polite">{status}</p>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={darkMode ? 'Light mode' : 'Dark mode'}
      aria-pressed={darkMode}
      onclick={toggleTheme}
    >
      {#if darkMode}<SunIcon aria-hidden="true" />{:else}<MoonIcon aria-hidden="true" />{/if}
    </Button>
  </header>
  {#if error}<p class="text-destructive" role="alert">{error}</p>{/if}

  {#if toastMessage}
    <div
      class="bg-foreground text-background fixed inset-x-0 top-4 z-50 mx-auto w-fit rounded-md px-4 py-2 text-sm shadow-lg"
      role="status"
      transition:fade={{ duration: 200 }}
    >
      {toastMessage}
    </div>
  {/if}

  <div class="tabs" role="tablist" aria-label="Diet sections">
    {#each tabs as { id, label, icon: Icon }}
      <button
        type="button"
        id={`${id}-tab`}
        role="tab"
        aria-selected={activeTab === id}
        aria-controls={`${id}-panel`}
        aria-label={label}
        class:active={activeTab === id}
        onclick={() => (activeTab = id as Tab)}
      >
        <Icon aria-hidden="true" />
      </button>
    {/each}
  </div>

  {#if activeTab === 'backup'}
    <BackupPanel
      {selectedBackupName}
      {backupPreview}
      {installed}
      canInstall={!!installPrompt}
      onExport={exportBackup}
      onSelectBackup={selectBackup}
      onRestore={restoreBackup}
      onInstall={installApp}
    />
  {:else if activeTab === 'summary'}
    <SummaryPanel
      {data}
      {date}
      {today}
      {recentDays}
      {dayTones}
      {totals}
      {targets}
      {caloriePercent}
      {caloriesRemaining}
      {calorieColor}
      onSelectDate={(iso) => (date = iso)}
      onEditMeal={editMeal}
      onDeleteMeal={removeMeal}
      onRecordMeal={startNewMeal}
      onQuickAdd={startTemporaryMeal}
    />
  {:else if activeTab === 'foods'}
    <FoodsPanel {data} onAddFood={startNewFood} onEditFood={editFood} />
  {:else if activeTab === 'profile'}
    <ProfilePanel
      bind:profile
      bind:overrideCalories
      bind:overrideProtein
      bind:overrideFat
      bind:overrideCarbohydrates
      {today}
      {maintenanceCalories}
      {targets}
      onSave={saveProfile}
    />
  {/if}

  <Sheet.Root bind:open={mealDialogOpen}>
    <Sheet.Content side="right" class="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none">
      <Sheet.Header>
        <Sheet.Title>{editingMealId ? 'Edit meal' : 'Record a meal'}</Sheet.Title>
        <Sheet.Description
          >{temporaryMeal
            ? 'Record nutrition without saving a food.'
            : 'Select a food, then set its time and quantity.'}</Sheet.Description
        >
      </Sheet.Header>
      <div class="flex-1 overflow-y-auto px-6 pb-6">
        <form onsubmit={addMeal} novalidate>
          {#if temporaryMeal}
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
          {:else}
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
                  <button
                    type="button"
                    class="meal-card"
                    class:selected={selectedFoodId === food.id}
                    onclick={() => chooseFoodResult(food.id)}
                  >
                    <span class="meal-name">{food.name.en ?? Object.values(food.name)[0]}</span>
                    {#if food.description}<span class="meal-card-topline">{food.description}</span>{/if}
                    <strong class="meal-calories">{displayNumber(food.nutrition.calories)} kcal</strong>
                    <span class="meal-card-topline">{food.serving}</span>
                  </button>
                {/each}
              </div>
            {/if}
            {#if creatingMealFood}
              <Button type="button" variant="outline" onclick={addFoodFromMealSearch}>Add food</Button>
            {/if}
          {/if}
          <div class="grid gap-2">
            <Label for="meal-time">Time</Label>
            <Input id="meal-time" type="time" step="600" bind:value={time} required />
          </div>
          {#if !temporaryMeal}
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
          {/if}
          {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
          <Button
            type="submit"
            variant={temporaryMeal || selectedFoodId ? 'default' : 'outline'}
            disabled={!temporaryMeal && !selectedFoodId}>{editingMealId ? 'Update meal' : 'Add meal'}</Button
          >
        </form>
      </div>
    </Sheet.Content>
  </Sheet.Root>

  <FoodSheet bind:this={foodSheet} {data} onSave={save} onSaved={handleFoodSaved} onError={handleFoodError} />
</main>
