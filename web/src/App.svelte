<script lang="ts">
  import { onMount } from 'svelte'
  import {
    createFood,
    createMealEntry,
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
    updateFood,
    updateMealEntry,
    type ImportResult,
  } from './domain/store'
  import { createIndexedDBStore } from './storage/indexeddb'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Card from '$lib/components/ui/card'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as Sheet from '$lib/components/ui/sheet'
  import { Separator } from '$lib/components/ui/separator'
  import { fade } from 'svelte/transition'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import MinusIcon from '@lucide/svelte/icons/minus'
  import FlameIcon from '@lucide/svelte/icons/flame'
  import HamIcon from '@lucide/svelte/icons/ham'
  import WheatIcon from '@lucide/svelte/icons/wheat'
  import NutIcon from '@lucide/svelte/icons/nut'
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
    date.setFullYear(date.getFullYear() + 1)
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
  let editingFoodId = $state('')
  let editingMealId = $state('')
  let time = $state(new Date().toTimeString().slice(0, 5))
  let quantity = $state(1)
  let foodName = $state('')
  let serving = $state('1 serving')
  let calories = $state(0)
  let protein = $state(0)
  let fat = $state(0)
  let carbohydrates = $state(0)
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
  let mealActionsId = $state('')
  let mealActionsOpen = $state(false)
  let mealDialogOpen = $state(false)
  let foodDialogOpen = $state(false)
  let creatingMealFood = $state(false)
  let foodSearchMessage = $state('')
  let darkMode = $state(false)
  type Tab = 'summary' | 'foods' | 'profile' | 'backup'
  let activeTab: Tab = $state('summary')

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  const totals = $derived(dailyTotals(data, date))
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
      const existing = new Set(data.foods.map((food) => food.id))
      const foods = [...bundledFoods.filter((food) => !existing.has(food.id)), ...data.foods]
      if (
        foods.length !== data.foods.length ||
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
      backupText = await file.text()
      backupPreview = previewBackup(backupText)
      error = ''
    } catch (cause) {
      backupText = ''
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
      await store.save($state.snapshot(next))
      data = next
      error = ''
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to save local data.'
    }
  }

  async function addFood(event: SubmitEvent) {
    event.preventDefault()
    try {
      const input = {
        name: { en: foodName },
        serving,
        nutrition: { calories, protein, fat, carbohydrates },
        source: 'user' as const,
      }
      const next = editingFoodId
        ? updateFood(data, editingFoodId, input)
        : { ...data, foods: [...data.foods, createFood(input)] }
      await save(next)
      selectedFoodId = editingFoodId || next.foods.at(-1)?.id || ''
      editingFoodId = ''
      foodName = ''
      serving = '1 serving'
      calories = 0
      protein = 0
      fat = 0
      carbohydrates = 0
      foodDialogOpen = false
      if (creatingMealFood) {
        foodSearch = next.foods.find((item) => item.id === selectedFoodId)?.name.en ?? foodSearch
        creatingMealFood = false
        foodSearchMessage = ''
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to create food.'
    }
  }

  async function addMeal(event: SubmitEvent) {
    event.preventDefault()
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
    editingFoodId = id
    foodName = food.name.en ?? Object.values(food.name)[0]
    serving = food.serving
    ;({ calories, protein, fat, carbohydrates } = food.nutrition)
    foodDialogOpen = true
  }

  function startNewFood() {
    editingFoodId = ''
    foodName = ''
    serving = '1 serving'
    calories = 0
    protein = 0
    fat = 0
    carbohydrates = 0
    foodDialogOpen = true
  }

  function addFoodFromMealSearch() {
    editingFoodId = ''
    foodName = foodSearch.trim()
    serving = '1 serving'
    calories = 0
    protein = 0
    fat = 0
    carbohydrates = 0
    foodDialogOpen = true
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
      foodName = name
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
    foodSearchMessage = ''
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
    {#each [['summary', 'Summary', ChartColumnIcon], ['foods', 'Foods', AppleIcon], ['profile', 'Profile', UserIcon], ['backup', 'Backup', SaveIcon]] as [id, label, Icon]}
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
    <div id="backup-panel" role="tabpanel" aria-labelledby="backup-tab">
      <Card.Root>
        <Card.Header><Card.Title id="backup-heading">Backup and install</Card.Title></Card.Header>
        <Card.Content class="flex flex-col gap-4">
          <Button type="button" onclick={exportBackup}>Export JSON backup</Button>
          <div class="flex flex-col gap-2">
            <Label for="backup-file">Import JSON backup</Label>
            <Input id="backup-file" type="file" accept="application/json,.json" onchange={selectBackup} />
          </div>
          {#if backupPreview}
            <p role="status">
              Ready to merge <strong class="font-semibold">{backupPreview.data.foods.length}</strong> foods and
              <strong class="font-semibold">{backupPreview.data.mealEntries.length}</strong> meals.
            </p>
            <Button type="button" onclick={restoreBackup}>Restore backup</Button>
          {/if}
          {#if installed}
            <p class="text-sm text-muted-foreground">This app is installed.</p>
          {:else if installPrompt}
            <Button type="button" onclick={installApp}>Install app</Button>
          {:else}
            <p class="text-sm text-muted-foreground">Install is available from your browser menu when supported.</p>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>
  {:else if activeTab === 'summary'}
    <div id="summary-panel" role="tabpanel" aria-labelledby="summary-tab">
      <Card.Root>
        <Card.Header><Card.Title id="summary-heading">Daily summary</Card.Title></Card.Header>
        <Card.Content>
          <div class="day-strip" aria-label="Recent days">
            {#each recentDays as day}
              {@const dayCalories = dailyTotals(data, day.iso).calories}
              {@const tone = dayTones[day.iso]}
              <button
                type="button"
                class:selected={date === day.iso}
                class:under={tone === 'under'}
                class:on-target={tone === 'on-target'}
                class:over={tone === 'over'}
                class:empty={tone === 'empty'}
                aria-pressed={date === day.iso}
                aria-label={`${day.label} ${day.number}, ${dayCalories} kcal`}
                onclick={() => (date = day.iso)}
              >
                <span class="day-label">{day.label}</span>
                <span class={`day-circle ${tone}`} class:today={day.iso === today} aria-hidden="true"
                  ><span>{day.number}</span></span
                >
              </button>
            {/each}
          </div>
          <div
            id="calorie-summary"
            class="flex items-center justify-between my-4 rounded-md bg-card p-4"
            role="img"
            aria-label={`${totals.calories} of ${targets.calories} kcal, ${caloriePercent}% of target`}
          >
            <div class="calorie-details">
              <strong>{totals.calories} kcal</strong>
              <span>{Math.abs(caloriesRemaining)} kcal {caloriesRemaining >= 0 ? 'left' : 'over'}</span>
            </div>
            <div
              class="relative flex aspect-square w-full max-w-28 flex-none items-center rounded-full text-center"
              style={`--calorie-progress: ${Math.min(caloriePercent, 100)}%; --calorie-color: ${calorieColor}; background: conic-gradient(var(--calorie-color) var(--calorie-progress), var(--muted) 0)`}
              aria-hidden="true"
            >
              <div class="absolute inset-3 rounded-full bg-card flex items-center justify-center">
                <FlameIcon aria-hidden="true" class="size-6" style={`color: ${calorieColor}`} />
              </div>
            </div>
          </div>
          <div class="macro-grid" aria-label="Macronutrient totals">
            <div class="macro-stat">
              <span><HamIcon aria-hidden="true" class="size-4" /> Protein</span
              ><strong>{Math.round(totals.protein)} / {Math.round(targets.protein)}</strong>
            </div>
            <div class="macro-stat">
              <span><WheatIcon aria-hidden="true" class="size-4" /> Carbs</span
              ><strong>{Math.round(totals.carbohydrates)} / {Math.round(targets.carbohydrates)}</strong
              >
            </div>
            <div class="macro-stat">
              <span><NutIcon aria-hidden="true" class="size-4" /> Fat</span
              ><strong>{Math.round(totals.fat)} / {Math.round(targets.fat)}</strong>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <div>
        <h2 id="entries-heading" class="font-heading text-base font-medium mb-4">Meals for {date}</h2>
        <div>
          <div class="meal-list">
            {#each data.mealEntries
              .filter((entry) => entry.date === date)
              .sort((a, b) => a.time.localeCompare(b.time)) as entry}
              {@const food = data.foods.find((item) => item.id === entry.foodId)}
              <button
                type="button"
                class="meal-card"
                aria-haspopup="dialog"
                aria-label={`${entry.time}, ${food?.name.en ?? 'Food'}, ${entry.nutrition.calories} kcal. Open meal actions.`}
                onclick={() => {
                  mealActionsId = entry.id
                  mealActionsOpen = true
                }}
              >
                <div class="flex items-center justify-between">
                  <span class="meal-name">{food?.name.en ?? 'Food'}</span>
                  <time datetime={`${entry.date}T${entry.time}`} class="text-muted-foreground">{entry.time}</time>
                </div>
                <strong class="meal-calories">{entry.nutrition.calories} kcal</strong>
                <span class="meal-macros">
                  <span
                    ><span class="meal-macro-label"><HamIcon aria-hidden="true" class="size-3.5" /> Protein</span
                    ><strong>{entry.nutrition.protein} g</strong></span
                  >
                  <span
                    ><span class="meal-macro-label"><WheatIcon aria-hidden="true" class="size-3.5" /> Carbs</span
                    ><strong>{entry.nutrition.carbohydrates} g</strong></span
                  >
                  <span
                    ><span class="meal-macro-label"><NutIcon aria-hidden="true" class="size-3.5" /> Fat</span
                    ><strong>{entry.nutrition.fat} g</strong></span
                  >
                </span>
              </button>
            {:else}
              <p>No meals recorded.</p>
            {/each}
          </div>
          <Dialog.Root bind:open={mealActionsOpen}>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Meal actions</Dialog.Title>
                <Dialog.Description>Choose what to do with this meal.</Dialog.Description>
              </Dialog.Header>
              <Dialog.Footer>
                <Button
                  type="button"
                  variant="outline"
                  onclick={() => {
                    editMeal(mealActionsId)
                    mealActionsOpen = false
                  }}>Edit meal</Button
                >
                <Button
                  type="button"
                  variant="destructive"
                  onclick={async () => {
                    await removeMeal(mealActionsId)
                    mealActionsOpen = false
                  }}>Delete meal</Button
                >
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      </div>
      <Button type="button" class="w-full mt-4" aria-haspopup="dialog" onclick={startNewMeal}>
        <PlusIcon aria-hidden="true" />
        Record a meal
      </Button>
    </div>
  {:else if activeTab === 'foods'}
    <div id="foods-panel" role="tabpanel" aria-labelledby="foods-tab">
      <Button type="button" class="w-full" onclick={startNewFood}>
        <PlusIcon aria-hidden="true" />
        Add food
      </Button>

      <div class="mt-4 grid gap-3">
        {#each data.foods.filter((food) => food.source === 'user') as food}
          <button
            type="button"
            class="w-full rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-ring focus-visible:outline-offset-2"
            aria-label={`Edit ${food.name.en ?? Object.values(food.name)[0]}`}
            onclick={() => editFood(food.id)}
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold">{food.name.en ?? Object.values(food.name)[0]}</span>
              <span class="text-lg font-semibold">{food.nutrition.calories} kcal</span>
            </div>
            <span class="text-sm text-muted-foreground">{food.serving}</span>
          </button>
        {:else}
          <p class="text-muted-foreground">No custom foods yet. Tap "Add food" to create one.</p>
        {/each}
      </div>
    </div>
  {:else if activeTab === 'profile'}
    <div id="profile-panel" role="tabpanel" aria-labelledby="profile-tab">
      <Card.Root class="overflow-visible">
        <Card.Header><Card.Title id="profile-heading">Profile and targets</Card.Title></Card.Header>
        <Card.Content>
          <form class="grid gap-4" onsubmit={saveProfile}>
            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <Label for="profile-age">Age</Label>
                <Input id="profile-age" type="number" min="1" max="120" bind:value={profile.age} required />
              </div>
              <div class="grid gap-2">
                <Label for="profile-sex">Sex</Label>
                <select
                  id="profile-sex"
                  class="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
                  bind:value={profile.sex}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <Label for="profile-height">Height (cm)</Label>
                <Input id="profile-height" type="number" min="50" max="250" bind:value={profile.heightCm} required />
              </div>
              <div class="grid gap-2">
                <Label for="profile-weight">Weight (kg)</Label>
                <Input
                  id="profile-weight"
                  type="number"
                  min="10"
                  max="500"
                  step="0.1"
                  bind:value={profile.weightKg}
                  required
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <Label for="profile-target-weight">Target weight (kg)</Label>
                <Input
                  id="profile-target-weight"
                  type="number"
                  min="10"
                  max="500"
                  step="0.1"
                  bind:value={profile.targetWeightKg}
                  required
                />
              </div>
              <div class="grid gap-2">
                <Label for="profile-target-date">Target date</Label>
                <Input id="profile-target-date" type="date" min={today} bind:value={profile.targetDate} required />
              </div>
            </div>
            <div class="grid gap-4">
              <Label for="profile-activity">Activity</Label>
              <select
                id="profile-activity"
                class="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
                bind:value={profile.activity}
              >
                <option value="bmrOnly">BMR only</option>
                <option value="sedentary">Sedentary</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="very">Very active</option>
                <option value="extra">Extra active</option>
              </select>
            </div>
            <div class="bg-muted flex items-baseline justify-between rounded-md px-4 py-3">
              <span class="text-muted-foreground text-sm">Daily maintenance</span>
              <span class="text-xl font-semibold tabular-nums">{maintenanceCalories} kcal</span>
            </div>

            <Separator />

            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <Label for="profile-override-calories">Calories override</Label>
                <Input id="profile-override-calories" type="number" min="0" bind:value={overrideCalories} />
              </div>
              <div class="grid gap-2">
                <Label for="profile-override-protein">Protein override</Label>
                <Input id="profile-override-protein" type="number" min="0" step="0.1" bind:value={overrideProtein} />
              </div>
              <div class="grid gap-2">
                <Label for="profile-override-fat">Fat override</Label>
                <Input id="profile-override-fat" type="number" min="0" step="0.1" bind:value={overrideFat} />
              </div>
              <div class="grid gap-2">
                <Label for="profile-override-carbs">Carbohydrates override</Label>
                <Input
                  id="profile-override-carbs"
                  type="number"
                  min="0"
                  step="0.1"
                  bind:value={overrideCarbohydrates}
                />
              </div>
            </div>

            <div class="bg-accent rounded-md px-4 py-3">
              <p class="text-2xl font-bold tabular-nums text-accent-foreground">{targets.calories} kcal</p>
              <p class="text-muted-foreground text-sm">
                {targets.protein} g protein · {targets.fat} g fat · {targets.carbohydrates} g carbs
              </p>
            </div>
            <Button type="submit">Save profile</Button>
          </form>
        </Card.Content>
      </Card.Root>
    </div>
  {/if}

  <Sheet.Root bind:open={mealDialogOpen}>
    <Sheet.Content side="right" class="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none">
      <Sheet.Header>
        <Sheet.Title>{editingMealId ? 'Edit meal' : 'Record a meal'}</Sheet.Title>
        <Sheet.Description>Select a food, then set its time and quantity.</Sheet.Description>
      </Sheet.Header>
      <div class="flex-1 overflow-y-auto px-6 pb-6">
        <form onsubmit={addMeal} novalidate>
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
                  <strong class="meal-calories">{food.nutrition.calories} kcal</strong>
                  <span class="meal-card-topline">{food.serving}</span>
                </button>
              {/each}
            </div>
          {/if}
          {#if creatingMealFood}
            <Button type="button" variant="outline" onclick={addFoodFromMealSearch}>Add food</Button>
          {/if}
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
          <Button type="submit" variant={selectedFoodId ? 'default' : 'outline'} disabled={!selectedFoodId}
            >{editingMealId ? 'Update meal' : 'Add meal'}</Button
          >
        </form>
      </div>
    </Sheet.Content>
  </Sheet.Root>

  <Sheet.Root bind:open={foodDialogOpen}>
    <Sheet.Content side="right" class="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none">
      <Sheet.Header>
        <Sheet.Title>{editingFoodId ? 'Edit food' : 'Add food'}</Sheet.Title>
        <Sheet.Description>Enter the food's serving size and nutrition per serving.</Sheet.Description>
      </Sheet.Header>
      <div class="flex-1 overflow-y-auto px-6 pb-6">
        <form class="grid gap-4" onsubmit={addFood}>
          <div class="grid gap-2">
            <Label for="food-name">Name</Label>
            <Input id="food-name" bind:value={foodName} required />
          </div>
          <div class="grid gap-2">
            <Label for="food-serving">Serving</Label>
            <Input id="food-serving" bind:value={serving} required />
          </div>
          <div class="grid gap-2">
            <Label for="food-calories">Calories</Label>
            <Input id="food-calories" type="number" min="0" bind:value={calories} required />
          </div>
          <div class="grid gap-2">
            <Label for="food-protein">Protein</Label>
            <Input id="food-protein" type="number" min="0" step="0.1" bind:value={protein} required />
          </div>
          <div class="grid gap-2">
            <Label for="food-fat">Fat</Label>
            <Input id="food-fat" type="number" min="0" step="0.1" bind:value={fat} required />
          </div>
          <div class="grid gap-2">
            <Label for="food-carbohydrates">Carbohydrates</Label>
            <Input id="food-carbohydrates" type="number" min="0" step="0.1" bind:value={carbohydrates} required />
          </div>
          <Button type="submit">{editingFoodId ? 'Update food' : 'Save food'}</Button>
        </form>
      </div>
    </Sheet.Content>
  </Sheet.Root>
</main>
