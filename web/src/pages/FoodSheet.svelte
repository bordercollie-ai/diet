<script lang="ts">
  import { createFood, toggleFavoriteFood, updateFood, type AppData, type Food } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { swipeBack } from '$lib/actions/swipe-back'
  import NavCircleButton from '$lib/components/nav-circle-button.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import StarIcon from '@lucide/svelte/icons/star'
  import XIcon from '@lucide/svelte/icons/x'
  import { foodName as pickFoodName, t, translate } from '../lib/i18n.svelte'

  let {
    data,
    onSave,
    onSaved,
    onError,
    onAddToMeal,
  }: {
    data: AppData
    onSave: (next: AppData) => Promise<void>
    onSaved?: (food: Food) => void
    onError?: (message: string) => void
    onAddToMeal?: (food: Food) => void
  } = $props()

  let open = $state(false)
  let editingFoodId = $state('')
  let foodName = $state('')
  let foodDescription = $state('')
  let serving = $state(translate('oneServing'))
  let calories = $state(0)
  let protein = $state(0)
  let fat = $state(0)
  let carbohydrates = $state(0)

  // ponytail: plain fixed-page overlay instead of a dialog primitive — this page
  // always covers the full viewport, so there's no focus trap / outside-click
  // surface to manage, just a scroll lock while it's open.
  $effect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  })

  function close() {
    open = false
  }

  function reset() {
    editingFoodId = ''
    foodName = ''
    foodDescription = ''
    serving = translate('oneServing')
    calories = 0
    protein = 0
    fat = 0
    carbohydrates = 0
  }

  export function openForNew() {
    reset()
    open = true
  }

  export function openForEdit(food: Food) {
    editingFoodId = food.id
    foodName = pickFoodName(food.name)
    foodDescription = food.description ?? ''
    serving = food.serving
    ;({ calories, protein, fat, carbohydrates } = food.nutrition)
    open = true
  }

  function handleAddToMeal() {
    const food = data.foods.find((item) => item.id === editingFoodId)
    if (!food) return
    open = false
    onAddToMeal?.(food)
  }

  const isFavorite = $derived((data.favoriteFoodIds ?? []).includes(editingFoodId))
  function toggleFavorite() {
    void onSave(toggleFavoriteFood(data, editingFoodId))
  }

  export function openWithName(name: string) {
    reset()
    foodName = name
    open = true
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    try {
      const input = {
        name: { en: foodName },
        description: foodDescription.trim() || undefined,
        serving,
        nutrition: { calories, protein, fat, carbohydrates },
        source: 'user' as const,
      }
      const next = editingFoodId
        ? updateFood(data, editingFoodId, input)
        : { ...data, foods: [...data.foods, createFood(input)] }
      await onSave(next)
      const savedId = editingFoodId || next.foods.at(-1)?.id || ''
      const saved = next.foods.find((food) => food.id === savedId)
      open = false
      if (saved) onSaved?.(saved)
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : translate('unableCreateFood'))
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex flex-col bg-popover text-sm text-popover-foreground [touch-action:pan-y]"
    role="dialog"
    aria-modal="true"
    aria-label={editingFoodId ? t('customFood') : t('addFood')}
    use:swipeBack={close}
  >
    <div class="flex items-start justify-between gap-4 px-3 py-6 pb-0">
      <div class="flex flex-col gap-1.5">
        <h2 class="font-heading text-base font-medium text-foreground">
          {editingFoodId ? t('customFood') : t('addFood')}
        </h2>
        <p class="text-muted-foreground">{t('addFoodToLocalDatabase')}</p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        {#if editingFoodId}
          <NavCircleButton label={isFavorite ? t('removeFromFavorites') : t('addToFavorites')} onclick={toggleFavorite}>
            <StarIcon aria-hidden="true" class={`size-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </NavCircleButton>
        {/if}
        <NavCircleButton label={t('close')} onclick={close}>
          <XIcon aria-hidden="true" class="size-5" />
        </NavCircleButton>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-6">
      <form class="grid gap-4" onsubmit={handleSubmit}>
        <div class="grid gap-2">
          <Label for="food-title">{t('name')}</Label>
          <Input id="food-title" bind:value={foodName} required />
        </div>
        <div class="grid gap-2">
          <Label for="food-description">{t('descriptionEgBrand')}</Label>
          <Input id="food-description" bind:value={foodDescription} placeholder={t('optional')} />
        </div>
        <div class="grid gap-2">
          <Label for="food-serving">{t('serving')}</Label>
          <Input id="food-serving" bind:value={serving} required />
        </div>
        <div class="grid gap-2">
          <Label for="food-calories">{t('calories')}</Label>
          <Input
            id="food-calories"
            type="number"
            min="0"
            step="any"
            value={calories}
            oninput={(e) => (calories = e.currentTarget.valueAsNumber || 0)}
          />
        </div>
        <div class="grid gap-2">
          <Label for="food-protein">{t('protein')}</Label>
          <Input
            id="food-protein"
            type="number"
            min="0"
            step="any"
            value={protein}
            oninput={(e) => (protein = e.currentTarget.valueAsNumber || 0)}
          />
        </div>
        <div class="grid gap-2">
          <Label for="food-fat">{t('fat')}</Label>
          <Input
            id="food-fat"
            type="number"
            min="0"
            step="any"
            value={fat}
            oninput={(e) => (fat = e.currentTarget.valueAsNumber || 0)}
          />
        </div>
        <div class="grid gap-2">
          <Label for="food-carbohydrates">{t('carbohydrates')}</Label>
          <Input
            id="food-carbohydrates"
            type="number"
            min="0"
            step="any"
            value={carbohydrates}
            oninput={(e) => (carbohydrates = e.currentTarget.valueAsNumber || 0)}
          />
        </div>
        <Button type="submit">{editingFoodId ? t('updateFood') : t('saveFood')}</Button>
        {#if editingFoodId}
          <Button type="button" variant="outline" onclick={handleAddToMeal}>
            <PlusIcon aria-hidden="true" />
            {t('addToTodaysMeal')}
          </Button>
        {/if}
      </form>
    </div>
  </div>
{/if}
