<script lang="ts">
  import { roundForDisplay, type AppData } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import PlusIcon from '@lucide/svelte/icons/plus'

  let {
    data,
    onAddFood,
    onEditFood,
  }: {
    data: AppData
    onAddFood: () => void
    onEditFood: (id: string) => void
  } = $props()

  const displayNumber = roundForDisplay
</script>

<div id="foods-panel" role="tabpanel" aria-labelledby="foods-tab">
  <Button type="button" class="w-full" onclick={onAddFood}>
    <PlusIcon aria-hidden="true" />
    Add food
  </Button>

  <div class="mt-4 grid gap-3">
    {#each data.foods.filter((food) => food.source === 'user') as food}
      <button
        type="button"
        class="w-full rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-ring focus-visible:outline-offset-2"
        aria-label={`Edit ${food.name.en ?? Object.values(food.name)[0]}`}
        onclick={() => onEditFood(food.id)}
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">{food.name.en ?? Object.values(food.name)[0]}</span>
          <span class="text-lg font-semibold">{displayNumber(food.nutrition.calories)} kcal</span>
        </div>
        {#if food.description}<span class="text-sm text-muted-foreground">{food.description}</span>{/if}
        <span class="text-sm text-muted-foreground">{food.serving}</span>
      </button>
    {:else}
      <p class="text-muted-foreground">No custom foods yet. Tap "Add food" to create one.</p>
    {/each}
  </div>
</div>
