<script lang="ts">
  import { roundForDisplay, type AppData } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import StarIcon from '@lucide/svelte/icons/star'
  import { foodName, t } from '../lib/i18n.svelte'

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

  const customFoods = $derived(
    data.foods
      .filter((food) => food.source === 'user')
      .toSorted((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
  )
</script>

<div id="foods-panel" role="tabpanel" aria-labelledby="foods-tab">
  <Button type="button" class="w-full" onclick={onAddFood}>
    <PlusIcon aria-hidden="true" />
    {t('addFood')}
  </Button>

  <div class="mt-4 grid gap-3">
    {#each customFoods as food}
      <Button
        variant="secondary"
        class="h-auto w-full min-w-0 flex-col items-stretch gap-0 rounded-md py-2 px-4 text-left whitespace-normal"
        aria-label={`${t('editFood')} ${foodName(food.name)}`}
        onclick={() => onEditFood(food.id)}
      >
        <div class="flex items-center justify-between gap-2">
          <span class="min-w-0 truncate">{foodName(food.name)}</span>
          <span class="shrink-0 whitespace-nowrap">{displayNumber(food.nutrition.calories)} kcal</span>
        </div>
        {#if food.description}<span class="text-sm text-muted-foreground">{food.description}</span>{/if}
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm text-muted-foreground">{food.serving}</span>
          {#if (data.favoriteFoodIds ?? []).includes(food.id)}
            <StarIcon aria-hidden="true" class="size-4 shrink-0 fill-yellow-400 text-yellow-400" />
          {/if}
        </div>
      </Button>
    {:else}
      <p class="text-muted-foreground">{t('noCustomFoodsYet')}</p>
    {/each}
  </div>
</div>
