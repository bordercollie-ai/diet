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
      <Button
        variant="secondary"
        class="h-auto w-full min-w-0 flex-col items-stretch gap-0 rounded-md py-2 px-4 text-left whitespace-normal"
        aria-label={`Edit ${food.name.en ?? Object.values(food.name)[0]}`}
        onclick={() => onEditFood(food.id)}
      >
        <div class="flex items-center justify-between gap-2">
          <span class="min-w-0 truncate">{food.name.en ?? Object.values(food.name)[0]}</span>
          <span class="shrink-0 whitespace-nowrap">{displayNumber(food.nutrition.calories)} kcal</span>
        </div>
        {#if food.description}<span class="text-sm text-muted-foreground">{food.description}</span>{/if}
        <span class="text-sm text-muted-foreground">{food.serving}</span>
      </Button>
    {:else}
      <p class="text-muted-foreground">No custom foods yet. Tap "Add food" to create one.</p>
    {/each}
  </div>
</div>
