<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import AppleIcon from '@lucide/svelte/icons/apple'
  import HouseIcon from '@lucide/svelte/icons/house'
  import MenuIcon from '@lucide/svelte/icons/menu'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import ZapIcon from '@lucide/svelte/icons/zap'
  import { onMount, type Snippet } from 'svelte'
  import { fade } from 'svelte/transition'
  import {
    bundledFoods,
    calorieTone,
    createMealEntry,
    dailyTotals,
    deleteMealEntry,
    estimateMaintenanceCalories,
    estimateTargets,
    resolveDarkMode,
    previewBackup,
    resolveTargets,
    roundForDisplay,
    type AppData,
    type Food,
    type ImportResult,
    type Profile,
    type ThemePreference,
  } from './domain/store'
  import BackButton from '$lib/components/back-button.svelte'
  import SwipeLayer from '$lib/components/swipe-layer.svelte'
  import BackupPanel from './pages/BackupPanel.svelte'
  import CalendarPanel from './pages/CalendarPanel.svelte'
  import FoodSheet from './pages/FoodSheet.svelte'
  import FoodsPanel from './pages/FoodsPanel.svelte'
  import MealSheet from './pages/MealSheet.svelte'
  import MenuPanel from './pages/MenuPanel.svelte'
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
  // ponytail: separate state so picking a day on the calendar never leaks into the Home tab's date, and vice versa.
  let calendarDate = $state(today)
  let foodSheet: {
    openForNew: () => void
    openForEdit: (food: Food) => void
    openWithName: (name: string) => void
  }
  let mealSheet: {
    openForNew: () => void
    openForEdit: (id: string) => void
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
  let themePreference: ThemePreference = $state('system')
  let systemPrefersDark = $state(false)
  const darkMode = $derived(resolveDarkMode(themePreference, systemPrefersDark))
  $effect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  })
  type Tab = 'summary' | 'foods' | 'profile' | 'menu' | 'calendar' | 'backup'
  const tabs: { id: Tab; label: string; icon: typeof HouseIcon }[] = [
    { id: 'summary', label: 'Summary', icon: HouseIcon },
    { id: 'foods', label: 'Foods', icon: AppleIcon },
    { id: 'menu', label: 'Menu', icon: MenuIcon },
  ]
  let activeTab: Tab = $state('summary')
  let addMealMenuOpen = $state(false)

  function recordMeal() {
    addMealMenuOpen = false
    mealSheet.openForNew()
  }

  function quickAddMeal() {
    addMealMenuOpen = false
    mealSheet.openTemporary()
  }
  // ponytail: remembers only "came from calendar"; cleared by any other nav, no history stack needed.
  let returnToCalendar = $state(false)

  function openMenuPage(page: 'profile' | 'calendar' | 'backup') {
    activeTab = page
  }

  function goToSummaryFromCalendar(iso: string) {
    calendarDate = iso
    activeTab = 'summary'
    returnToCalendar = true
  }

  function selectTab(tab: Tab) {
    activeTab = tab
    returnToCalendar = false
  }

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  const summaryDate = $derived(returnToCalendar ? calendarDate : date)
  const totals = $derived(dailyTotals(data, summaryDate))
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
  const todayCalorieTone = $derived(calorieTone(totals.calories, targets.calories))
  const calorieColor = $derived(
    {
      under: 'var(--calorie-under)',
      'on-target': 'var(--calorie-under)',
      over: 'var(--calorie-over)',
      empty: 'var(--primary)',
      unavailable: 'var(--muted-foreground)',
    }[todayCalorieTone],
  )

  onMount(async () => {
    const storedTheme = localStorage.getItem('diet-theme')
    themePreference = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'system'
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark = media.matches
    media.addEventListener('change', (event) => (systemPrefersDark = event.matches))
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

  function setTheme(preference: ThemePreference) {
    themePreference = preference
    localStorage.setItem('diet-theme', preference)
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

  async function addFoodToMeal(food: Food) {
    try {
      const entry = createMealEntry(
        { date: today, time: new Date().toTimeString().slice(0, 5), foodId: food.id, quantity: 1 },
        food,
      )
      await save({ ...data, mealEntries: [...data.mealEntries, entry] })
      showToast("Added to today's meal.")
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to add meal.'
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

  function dayTone(iso: string) {
    return calorieTone(dailyTotals(data, iso).calories, targets.calories)
  }
  const dayTones = $derived(Object.fromEntries(recentDays.map((day) => [day.iso, dayTone(day.iso)])))

  function returnFromSummaryToCalendar() {
    activeTab = 'calendar'
    returnToCalendar = false
  }
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

  {#snippet menuScreen()}
    <MenuPanel onSelect={openMenuPage} {themePreference} onThemeChange={setTheme} />
  {/snippet}

  {#snippet calendarScreen()}
    <CalendarPanel {data} {today} {targets} onSelectDate={goToSummaryFromCalendar} />
  {/snippet}

  {#snippet overlayPage(content: Snippet)}
    <div
      class="h-full overflow-y-auto px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]"
    >
      {@render content()}
    </div>
  {/snippet}

  {#if activeTab === 'summary'}
    {#snippet summaryPanel()}
      <SummaryPanel
        {data}
        date={summaryDate}
        {today}
        {recentDays}
        {dayTones}
        showDayStrip={!returnToCalendar}
        {totals}
        {targets}
        {caloriePercent}
        {caloriesRemaining}
        {calorieColor}
        onSelectDate={(iso) => (date = iso)}
        onEditMeal={(id) => mealSheet.openForEdit(id)}
      />
    {/snippet}
    {#if returnToCalendar}
      <div class="fixed inset-0 z-40 bg-background">
        <SwipeLayer onBack={returnFromSummaryToCalendar}>
          {#snippet back()}
            {@render overlayPage(calendarScreen)}
          {/snippet}
          {#snippet front()}
            {#snippet summaryWithBack()}
              <BackButton label="Calendar" onclick={returnFromSummaryToCalendar}>
                {@render summaryPanel()}
              </BackButton>
            {/snippet}
            {@render overlayPage(summaryWithBack)}
          {/snippet}
        </SwipeLayer>
      </div>
    {:else}
      {@render summaryPanel()}
    {/if}
  {:else if activeTab === 'foods'}
    <FoodsPanel {data} onAddFood={startNewFood} onEditFood={editFood} />
  {:else if activeTab === 'profile' || activeTab === 'calendar' || activeTab === 'backup'}
    <div class="fixed inset-0 z-40 bg-background">
      <SwipeLayer onBack={() => (activeTab = 'menu')}>
        {#snippet back()}
          {@render overlayPage(menuScreen)}
        {/snippet}
        {#snippet front()}
          {#snippet activePanel()}
            <BackButton label="Menu" onclick={() => (activeTab = 'menu')}>
              {#if activeTab === 'profile'}
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
              {:else if activeTab === 'calendar'}
                {@render calendarScreen()}
              {:else}
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
            </BackButton>
          {/snippet}
          {@render overlayPage(activePanel)}
        {/snippet}
      </SwipeLayer>
    </div>
  {:else if activeTab === 'menu'}
    {@render menuScreen()}
  {/if}

  <MealSheet
    bind:this={mealSheet}
    {data}
    bind:date
    {today}
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
  <div class="mx-auto flex max-w-3xl items-center gap-2 px-3 pt-2" role="tablist" aria-label="Diet sections">
    <Popover bind:open={addMealMenuOpen}>
      <PopoverTrigger>
        {#snippet child({ props })}
          <button
            {...props}
            type="button"
            aria-label="Add meal options"
            class="flex min-w-0 flex-1 items-center justify-center rounded-sm bg-foreground py-2 text-background transition-transform active:scale-95"
          >
            <PlusIcon aria-hidden="true" class="size-5" />
          </button>
        {/snippet}
      </PopoverTrigger>
      <PopoverContent align="start" side="top" class="w-56">
        <Button type="button" variant="ghost" class="justify-start gap-2" onclick={recordMeal}>
          <PlusIcon aria-hidden="true" class="size-4" /> Add a meal
        </Button>
        <Button type="button" variant="ghost" class="justify-start gap-2" onclick={quickAddMeal}>
          <ZapIcon aria-hidden="true" class="size-4" /> Quick add
        </Button>
      </PopoverContent>
    </Popover>
    {#each tabs as { id, label, icon: Icon }}
      {@const selected =
        id === 'menu'
          ? activeTab === 'menu' || activeTab === 'profile' || activeTab === 'calendar' || activeTab === 'backup'
          : activeTab === id}
      <Button
        id={`${id}-tab`}
        role="tab"
        aria-selected={selected}
        aria-controls={`${id}-panel`}
        aria-label={label}
        size="icon-sm"
        variant="ghost"
        class="min-w-0 flex-1 rounded-lg hover:bg-transparent border-0 {selected
          ? 'text-foreground'
          : 'text-muted-foreground'}"
        onclick={() => selectTab(id)}
      >
        <Icon aria-hidden="true" class="size-5" />
      </Button>
    {/each}
  </div>
</nav>
