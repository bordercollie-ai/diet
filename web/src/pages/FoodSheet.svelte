<script lang="ts">
  import { createFood, updateFood, type AppData, type Food } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { swipeBack } from '$lib/actions/swipe-back'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import XIcon from '@lucide/svelte/icons/x'

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
  let serving = $state('1 serving')
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
    serving = '1 serving'
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
    foodName = food.name.en ?? Object.values(food.name)[0]
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
      onError?.(cause instanceof Error ? cause.message : 'Unable to create food.')
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex flex-col bg-popover text-sm text-popover-foreground"
    role="dialog"
    aria-modal="true"
    aria-label={editingFoodId ? 'Custom food' : 'Add food'}
    use:swipeBack={close}
  >
    <div class="flex items-start justify-between gap-4 p-6 pb-0">
      <div class="flex flex-col gap-1.5">
        <h2 class="font-heading text-base font-medium text-foreground">
          {editingFoodId ? 'Custom food' : 'Add food'}
        </h2>
        <p class="text-sm text-muted-foreground">Enter the food's serving size and nutrition per serving.</p>
      </div>
      <Button variant="ghost" size="icon-sm" class="bg-secondary" aria-label="Close" onclick={close}>
        <XIcon aria-hidden="true" />
      </Button>
    </div>
    <div class="flex-1 overflow-y-auto px-6 pb-6">
      <form class="grid gap-4" onsubmit={handleSubmit}>
        <div class="grid gap-2">
          <Label for="food-name">Name</Label>
          <Input id="food-name" bind:value={foodName} required />
        </div>
        <div class="grid gap-2">
          <Label for="food-description">Description (e.g. brand)</Label>
          <Input id="food-description" bind:value={foodDescription} placeholder="Optional" />
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
        {#if editingFoodId}
          <Button type="button" variant="outline" onclick={handleAddToMeal}>
            <PlusIcon aria-hidden="true" />
            Add to today's meal
          </Button>
        {/if}
      </form>
    </div>
  </div>
{/if}
