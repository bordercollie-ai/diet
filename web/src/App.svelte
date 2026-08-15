<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import AppleIcon from '@lucide/svelte/icons/apple'
  import HouseIcon from '@lucide/svelte/icons/house'
  import MenuIcon from '@lucide/svelte/icons/menu'
  import MoonIcon from '@lucide/svelte/icons/moon'
  import SunIcon from '@lucide/svelte/icons/sun'
  import UserIcon from '@lucide/svelte/icons/user'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import {
    bundledFoods,
    dailyTotals,
    deleteMealEntry,
    estimateMaintenanceCalories,
    estimateTargets,
    previewBackup,
    resolveTargets,
    roundForDisplay,
    type AppData,
    type Food,
    type ImportResult,
    type Profile,
  } from './domain/store'
  import BackupPanel from './pages/BackupPanel.svelte'
  import FoodSheet from './pages/FoodSheet.svelte'
  import FoodsPanel from './pages/FoodsPanel.svelte'
  import MealSheet from './pages/MealSheet.svelte'
  import ProfilePanel from './pages/ProfilePanel.svelte'
  import SummaryPanel from './pages/SummaryPanel.svelte'
  import { createIndexedDBStore } from './storage/indexeddb'

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
  let foodSheet: {
    openForNew: () => void
    openForEdit: (food: Food) => void
    openWithName: (name: string) => void
  }
  let mealSheet: {
    openForNew: () => void
    openForEdit: (id: string) => void
    openForFood: (foodId: string) => void
    openTemporary: () => void
    notifyFoodSaved: (food: Food) => void
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
  let darkMode = $state(false)
  type Tab = 'summary' | 'foods' | 'profile' | 'backup'
  const tabs: { id: Tab; label: string; icon: typeof HouseIcon }[] = [
    { id: 'summary', label: 'Summary', icon: HouseIcon },
    { id: 'foods', label: 'Foods', icon: AppleIcon },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'backup', label: 'Backup', icon: MenuIcon },
  ]
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
    mealSheet.notifyFoodSaved(food)
  }

  function handleFoodError(message: string) {
    error = message
  }

  function addFoodToMeal(food: Food) {
    mealSheet.openForFood(food.id)
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
  class="w-full max-w-3xl mx-auto px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]"
>
  <header class="flex items-center justify-between gap-4">
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

  {#if activeTab === 'summary'}
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
      onEditMeal={(id) => mealSheet.openForEdit(id)}
      onRecordMeal={() => mealSheet.openForNew()}
      onQuickAdd={() => mealSheet.openTemporary()}
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
  {:else if activeTab === 'backup'}
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
  {/if}

  <MealSheet
    bind:this={mealSheet}
    {data}
    bind:date
    onSave={save}
    onCreateFood={(name) => foodSheet.openWithName(name)}
    onDelete={removeMeal}
  />

  <FoodSheet
    bind:this={foodSheet}
    {data}
    onSave={save}
    onSaved={handleFoodSaved}
    onError={handleFoodError}
    onAddToMeal={addFoodToMeal}
  />
</main>

<nav class="fixed inset-x-0 bottom-0 z-30 border-t bg-background backdrop-blur pb-[env(safe-area-inset-bottom,0px)]">
  <div class="mx-auto flex max-w-3xl gap-0.5 px-3 pt-1" role="tablist" aria-label="Diet sections">
    {#each tabs as { id, label, icon: Icon }}
      <Button
        id={`${id}-tab`}
        role="tab"
        aria-selected={activeTab === id}
        aria-controls={`${id}-panel`}
        aria-label={label}
        size="icon-sm"
        variant="ghost"
        class="min-w-0 flex-1 rounded-lg hover:bg-transparent border-0 {activeTab === id
          ? 'text-foreground'
          : 'text-muted-foreground'}"
        onclick={() => (activeTab = id as Tab)}
      >
        <Icon aria-hidden="true" class="size-5" />
      </Button>
    {/each}
  </div>
</nav>
