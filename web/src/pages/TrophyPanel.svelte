<script lang="ts">
  import CrownIcon from '@lucide/svelte/icons/crown'
  import StarIcon from '@lucide/svelte/icons/star'
  import {
    achievementDefinitions,
    type AchievementId,
    type AchievementRecord,
    type AppData,
  } from '../domain/store'
  import { formatDateTime, t } from '../lib/i18n.svelte'
  import { onMount } from 'svelte'

  let {
    data,
    sessionUnreadIds,
    animatedIds,
    selectedAchievementId = $bindable(),
    mode = 'list',
  }: {
    data: AppData
    sessionUnreadIds: AchievementId[]
    animatedIds: AchievementId[]
    selectedAchievementId: AchievementId | null
    mode?: 'list' | 'detail'
  } = $props()

  let prefersReducedMotion = $state(false)

  onMount(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (event?: MediaQueryListEvent) => {
      prefersReducedMotion = event ? event.matches : media.matches
    }
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  })

  const records = $derived(new Map((data.achievements ?? []).map((record) => [record.id, record])))
  const unreadSet = $derived(new Set(sessionUnreadIds))
  const animatedSet = $derived(new Set(animatedIds))
  const achievements = $derived(
    achievementDefinitions.map((definition) => ({
      definition,
      record: records.get(definition.id) as AchievementRecord | undefined,
    })),
  )
  const newAchievements = $derived(achievements.filter((item) => item.record && unreadSet.has(item.definition.id)))
  const otherAchievements = $derived(achievements.filter((item) => !unreadSet.has(item.definition.id)))
  const selected = $derived(achievements.find((item) => item.definition.id === selectedAchievementId) ?? null)

  const badgeLabel = (icon: 'crown' | 'star', unlocked: boolean, number: string) =>
    `${t(unlocked ? 'unlocked' : 'locked')} ${t(icon === 'crown' ? 'crownBadge' : 'starBadge')} ${number}`
</script>

{#snippet badge(definition: (typeof achievementDefinitions)[number], record: AchievementRecord | undefined)}
  {@const unlocked = !!record}
  {@const entering = !prefersReducedMotion && animatedSet.has(definition.id)}
  <div
    class="achievement-badge"
    class:achievement-badge--locked={!unlocked}
    class:achievement-badge--unlocked={unlocked}
    class:achievement-badge--enter={entering}
    aria-label={badgeLabel(definition.badgeIcon, unlocked, definition.badgeNumber)}
    role="img"
  >
    <div class="achievement-badge__shape" aria-hidden="true">
      {#if definition.badgeIcon === 'crown'}
        <CrownIcon aria-hidden="true" class="achievement-badge__icon" />
      {:else}
        <StarIcon aria-hidden="true" class="achievement-badge__icon" />
      {/if}
    </div>
    <span class="achievement-badge__number" aria-hidden="true">{definition.badgeNumber}</span>
  </div>
{/snippet}

{#snippet achievementButton(definition: (typeof achievementDefinitions)[number], record: AchievementRecord | undefined)}
  <button
    type="button"
    class="achievement-card"
    class:achievement-card--new={unreadSet.has(definition.id)}
    class:achievement-card--enter={!prefersReducedMotion && animatedSet.has(definition.id)}
    onclick={() => (selectedAchievementId = definition.id)}
  >
    {@render badge(definition, record)}
    <div class="achievement-card__body">
      <div class="achievement-card__topline">
        <strong>{t(definition.titleKey)}</strong>
        <span class="text-sm text-muted-foreground">{t(record ? 'unlocked' : 'locked')}</span>
      </div>
      <p class="achievement-card__meta">
        {#if record}
          {t('earnedOn')}: {formatDateTime(record.unlockedAt, { dateStyle: 'medium', timeStyle: 'short' })}
        {:else}
          {t(definition.ruleKey)}
        {/if}
      </p>
    </div>
  </button>
{/snippet}

{#if mode === 'detail' && selected}
  <section aria-label={t('achievementDetail')} class="grid gap-4">
    <div class="achievement-detail">
      {@render badge(selected.definition, selected.record)}
      <div class="grid gap-2">
        <h2 class="m-0 text-xl font-semibold">{t(selected.definition.titleKey)}</h2>
        <p class="m-0 text-muted-foreground">{t(selected.definition.ruleKey)}</p>
      </div>
    </div>
    <div class="rounded-2xl bg-muted p-4">
      <p class="m-0 text-sm text-muted-foreground">{t(selected.record ? 'earnedOn' : 'locked')}</p>
      <p class="m-0 mt-1 font-medium">
        {selected.record
          ? formatDateTime(selected.record.unlockedAt, { dateStyle: 'full', timeStyle: 'short' })
          : t('notUnlockedYet')}
      </p>
    </div>
  </section>
{:else}
  <section aria-label={t('trophies')} class="grid gap-5">
    {#if newAchievements.length > 0}
      <div class="grid gap-2">
        <h2 class="m-0 text-base font-semibold">{t('newAchievements')}</h2>
        <div class="achievement-list">
          {#each newAchievements as item (item.definition.id)}
            {@render achievementButton(item.definition, item.record)}
          {/each}
        </div>
      </div>
    {/if}

    <div class="grid gap-2">
      <h2 class="m-0 text-base font-semibold">{t('allBadges')}</h2>
      <div class="achievement-list">
        {#each otherAchievements as item (item.definition.id)}
          {@render achievementButton(item.definition, item.record)}
        {/each}
      </div>
    </div>
  </section>
{/if}
