<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import AppleIcon from '@lucide/svelte/icons/apple'
  import HouseIcon from '@lucide/svelte/icons/house'
  import MenuIcon from '@lucide/svelte/icons/menu'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrophyIcon from '@lucide/svelte/icons/trophy'
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
    markAchievementsRead,
    prepareAppData,
    resolveDarkMode,
    previewBackup,
    resolveTargets,
    type AppData,
    type AchievementId,
    type Food,
    type ImportResult,
    type Profile,
    type ThemePreference,
  } from './domain/store'
  import BackButton from '$lib/components/back-button.svelte'
  import { swipeBack } from '$lib/actions/swipe-back'
  import AboutPanel from './pages/AboutPanel.svelte'
  import BackupPanel from './pages/BackupPanel.svelte'
  import CalendarPanel from './pages/CalendarPanel.svelte'
  import FoodSheet from './pages/FoodSheet.svelte'
  import FoodsPanel from './pages/FoodsPanel.svelte'
  import MealSheet from './pages/MealSheet.svelte'
  import MenuPanel from './pages/MenuPanel.svelte'
  import ProfilePanel from './pages/ProfilePanel.svelte'
  import SummaryPanel from './pages/SummaryPanel.svelte'
  import TrophyPanel from './pages/TrophyPanel.svelte'
  import { createIndexedDBStore } from './storage/indexeddb'
  import { getLanguage, setLanguage as setStoredLanguage, t, translate, type Language } from './lib/i18n.svelte'

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
  let status = $state(translate('loadingLocalData'))
  let error = $state('')
  let backupText = $state('')
  let selectedBackupName = $state('')
  let toastMessage = $state('')
  let toastTimer: ReturnType<typeof setTimeout>
  let trophyAnimationTimer: ReturnType<typeof setTimeout>

  function showToast(message: string) {
    toastMessage = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toastMessage = ''), 2500)
  }
  let backupPreview: ImportResult | null = $state(null)
  let installPrompt: BeforeInstallPromptEvent | null = $state(null)
  let installed = $state(false)
  let themePreference: ThemePreference = $state('system')
  let language: Language = $state(getLanguage())
  let systemPrefersDark = $state(false)
  const darkMode = $derived(resolveDarkMode(themePreference, systemPrefersDark))
  $effect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  })
  type Tab = 'summary' | 'foods' | 'menu'
  type MenuSubpage = 'profile' | 'calendar' | 'backup' | 'about'
  const tabs: { id: Tab; labelKey: string; icon: typeof HouseIcon }[] = [
    { id: 'summary', labelKey: 'summary', icon: HouseIcon },
    { id: 'foods', labelKey: 'foods', icon: AppleIcon },
    { id: 'menu', labelKey: 'menu', icon: MenuIcon },
  ]
  let activeTab: Tab = $state('summary')
  // Menu subpages (profile/calendar/backup/about) render as a sheet on top of the
  // real, still-mounted Menu tab — same pattern as MealSheet/FoodSheet — so swiping
  // away reveals the actual Menu screen (real header + bottom nav), not a faked copy.
  let menuSubpage: MenuSubpage | null = $state(null)
  let addMealMenuOpen = $state(false)
  let trophyOpen = $state(false)
  let selectedAchievementId: AchievementId | null = $state(null)
  let trophySessionUnreadIds: AchievementId[] = $state([])
  let trophyAnimatingIds: AchievementId[] = $state([])

  function recordMeal() {
    addMealMenuOpen = false
    mealSheet.openForNew()
  }

  function quickAddMeal() {
    addMealMenuOpen = false
    mealSheet.openTemporary()
  }
  // ponytail: remembers only "which date was picked on the calendar"; cleared by any other nav.
  let calendarJumpDate: string | null = $state(null)

  function openMenuPage(page: MenuSubpage) {
    activeTab = 'menu'
    menuSubpage = page
  }

  function closeMenuSubpage() {
    menuSubpage = null
  }

  // Pushes "Summary for this date" as a sheet on top of the still-mounted Calendar
  // sheet (itself on top of the Menu tab). Nothing here is faked or duplicated —
  // swiping away just closes the topmost sheet, revealing whatever's really beneath.
  function goToSummaryFromCalendar(iso: string) {
    calendarDate = iso
    calendarJumpDate = iso
  }

  function returnFromSummaryToCalendar() {
    calendarJumpDate = null
  }

  function closeTrophies() {
    trophyOpen = false
    selectedAchievementId = null
    trophySessionUnreadIds = []
    trophyAnimatingIds = []
    clearTimeout(trophyAnimationTimer)
  }

  function selectTab(tab: Tab) {
    activeTab = tab
    menuSubpage = null
    calendarJumpDate = null
  }

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  const summaryDate = $derived(calendarJumpDate ?? date)
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
  const unreadAchievementIds = $derived((data.achievements ?? []).filter((record) => !record.readAt).map((record) => record.id))
  const calorieColor = $derived(
    {
      under: 'var(--calorie-under)',
      'on-target': 'var(--calorie-under)',
      over: 'var(--calorie-over)',
      empty: 'var(--primary)',
      unavailable: 'var(--muted-foreground)',
    }[todayCalorieTone],
  )
  $effect(() => {
    if (selectedAchievementId) trophyAnimatingIds = []
  })

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
      status = translate('localDataReady')
    } catch (cause) {
      error = cause instanceof Error ? cause.message : translate('unableOpenLocalData')
    }
  })

  function setTheme(preference: ThemePreference) {
    themePreference = preference
    localStorage.setItem('diet-theme', preference)
  }

  function setLanguage(next: Language) {
    language = next
    setStoredLanguage(next)
  }

  async function exportBackup() {
    try {
      const blob = new Blob([await store.export()], { type: 'application/json' })
      const filename = `diet-backup-${today}.json`
      const file = new File([blob], filename, { type: 'application/json' })

      // ponytail: native share sheet when supported (iOS/Android/desktop PWA), falls back to
      // anchor download for browsers without Web Share Level 2 (e.g. desktop Firefox/Safari).
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
        status = translate('backupExported')
        error = ''
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      status = translate('backupExported')
      error = ''
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      error = cause instanceof Error ? cause.message : translate('unableExportBackup')
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
      error = cause instanceof Error ? cause.message : translate('unableReadBackup')
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
      status = translate('backupRestored')
      error = ''
    } catch (cause) {
      error = cause instanceof Error ? cause.message : translate('unableRestoreBackup')
    }
  }

  async function installApp() {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      installPrompt = null
    } catch (cause) {
      error = cause instanceof Error ? cause.message : translate('unableStartInstallation')
    }
  }

  async function save(next: AppData) {
    try {
      // ponytail: $state proxies aren't structured-cloneable; snapshot before persisting.
      const saved = prepareAppData($state.snapshot(next))
      await store.save(saved)
      data = saved
      error = ''
    } catch (cause) {
      error = cause instanceof Error ? cause.message : translate('unableSaveLocalData')
    }
  }

  function openTrophies() {
    const unreadIds = unreadAchievementIds
    trophySessionUnreadIds = [...unreadIds]
    trophyAnimatingIds = [...unreadIds]
    selectedAchievementId = null
    trophyOpen = true
    clearTimeout(trophyAnimationTimer)
    trophyAnimationTimer = setTimeout(() => {
      trophyAnimatingIds = []
    }, 3_100)
    if (unreadIds.length === 0) return
    void save(markAchievementsRead(data))
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
      showToast(translate('addedToTodaysMeal'))
    } catch (cause) {
      error = cause instanceof Error ? cause.message : translate('unableAddMeal')
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
      showToast(translate('profileSaved'))
    } catch (cause) {
      error = cause instanceof Error ? cause.message : translate('unableSaveProfile')
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
</script>

<svelte:head>
  <title>{t('appName')}</title>
  <meta name="theme-color" content="#ffffff" />
  <link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<main
  class="w-full max-w-3xl mx-auto px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]"
>
  <header class="flex items-center justify-between gap-4 border-b pb-3 mb-3">
    <div>
      <h1 class="m-0 text-2xl">{t('appName')}</h1>
      <p class="sr-only" role="status" aria-live="polite">{status}</p>
    </div>
    <Button type="button" variant="ghost" size="icon-sm" class="relative" aria-label={t('trophies')} onclick={openTrophies}>
      <TrophyIcon aria-hidden="true" class="size-5" />
      {#if unreadAchievementIds.length > 0}
        <span class="trophy-unread-dot" aria-hidden="true"></span>
      {/if}
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

  {#snippet menuScreen()}
    <MenuPanel onSelect={openMenuPage} {themePreference} onThemeChange={setTheme} {language} onLanguageChange={setLanguage} />
  {/snippet}

  {#snippet calendarScreen()}
    <CalendarPanel {data} {today} {targets} onSelectDate={goToSummaryFromCalendar} />
  {/snippet}

  {#snippet summaryPanel()}
    <SummaryPanel
      {data}
      date={summaryDate}
      {today}
      {recentDays}
      {dayTones}
      showDayStrip={calendarJumpDate === null}
      {totals}
      {targets}
      {caloriePercent}
      {caloriesRemaining}
      {calorieColor}
      onSelectDate={(iso) => (date = iso)}
      onEditMeal={(id) => mealSheet.openForEdit(id)}
    />
  {/snippet}

  {#snippet overlayPage(content: Snippet)}
    <div
      class="h-full overflow-y-auto px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]"
    >
      {@render content()}
    </div>
  {/snippet}

  <div inert={menuSubpage !== null} aria-hidden={menuSubpage !== null || undefined}>
    {#if activeTab === 'summary'}
      {@render summaryPanel()}
    {:else if activeTab === 'foods'}
      <FoodsPanel {data} onAddFood={startNewFood} onEditFood={editFood} />
    {:else if activeTab === 'menu'}
      {@render menuScreen()}
    {/if}
  </div>

  {#if menuSubpage}
    {#snippet menuSubpageContent()}
      <BackButton
        label={t('menu')}
        title={menuSubpage === 'profile'
          ? t('profileAndTargets')
          : menuSubpage === 'calendar'
            ? t('calendar')
            : menuSubpage === 'backup'
              ? t('backupAndInstall')
              : t('about')}
        onclick={closeMenuSubpage}
      >
        {#if menuSubpage === 'profile'}
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
        {:else if menuSubpage === 'calendar'}
          {@render calendarScreen()}
        {:else if menuSubpage === 'backup'}
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
        {:else}
          <AboutPanel />
        {/if}
      </BackButton>
    {/snippet}
    <div
      class="fixed inset-0 z-40 bg-background [touch-action:pan-y]"
      use:swipeBack={closeMenuSubpage}
      inert={calendarJumpDate !== null}
      aria-hidden={calendarJumpDate !== null || undefined}
    >
      {@render overlayPage(menuSubpageContent)}
    </div>
  {/if}

  {#if calendarJumpDate}
    <!-- Pushed on top of the Calendar sheet above (which itself sits on the Menu tab) -->
    {#snippet summaryJumpContent()}
      <BackButton label={t('calendar')} onclick={returnFromSummaryToCalendar}>
        {@render summaryPanel()}
      </BackButton>
    {/snippet}
    <div
      class="fixed inset-0 z-40 bg-background [touch-action:pan-y]"
      use:swipeBack={returnFromSummaryToCalendar}
    >
      {@render overlayPage(summaryJumpContent)}
    </div>
  {/if}

  {#if trophyOpen}
    {#snippet trophyContent()}
      <BackButton
        label={t('appName')}
        title={t('trophies')}
        onclick={closeTrophies}
      >
        <TrophyPanel
          {data}
          bind:selectedAchievementId
          sessionUnreadIds={trophySessionUnreadIds}
          animatedIds={trophyAnimatingIds}
        />
      </BackButton>
    {/snippet}
    <div
      class="fixed inset-0 z-50 bg-background [touch-action:pan-y]"
      use:swipeBack={closeTrophies}
      inert={selectedAchievementId !== null}
      aria-hidden={selectedAchievementId !== null || undefined}
    >
      {@render overlayPage(trophyContent)}
    </div>
  {/if}

  {#if selectedAchievementId}
    {#snippet achievementDetailContent()}
      <BackButton label={t('trophies')} title={t('achievementDetail')} onclick={() => (selectedAchievementId = null)}>
        <TrophyPanel
          {data}
          bind:selectedAchievementId
          sessionUnreadIds={trophySessionUnreadIds}
          animatedIds={[]}
          mode="detail"
        />
      </BackButton>
    {/snippet}
    <div class="fixed inset-0 z-60 bg-background [touch-action:pan-y]" use:swipeBack={() => (selectedAchievementId = null)}>
      {@render overlayPage(achievementDetailContent)}
    </div>
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
  <div class="mx-auto flex max-w-3xl items-center gap-2 px-3 pt-2" role="tablist" aria-label={t('dietSections')}>
    <Popover bind:open={addMealMenuOpen}>
      <PopoverTrigger>
        {#snippet child({ props })}
          <button
            {...props}
            type="button"
            aria-label={t('addMealOptions')}
            class="flex min-w-0 flex-1 items-center justify-center rounded-sm bg-foreground py-2 text-background transition-transform active:scale-95"
          >
            <PlusIcon aria-hidden="true" class="size-5" />
          </button>
        {/snippet}
      </PopoverTrigger>
      <PopoverContent align="start" side="top" class="w-56">
        <Button type="button" variant="ghost" class="justify-start gap-2" onclick={recordMeal}>
          <PlusIcon aria-hidden="true" class="size-4" /> {t('addAMeal')}
        </Button>
        <Button type="button" variant="ghost" class="justify-start gap-2" onclick={quickAddMeal}>
          <ZapIcon aria-hidden="true" class="size-4" /> {t('quickAdd')}
        </Button>
      </PopoverContent>
    </Popover>
    {#each tabs as { id, labelKey, icon: Icon }}
      {@const selected =
        id === 'menu'
          ? activeTab === 'menu'
          : activeTab === id}
      <Button
        id={`${id}-tab`}
        role="tab"
        aria-selected={selected}
        aria-controls={`${id}-panel`}
        aria-label={t(labelKey)}
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
