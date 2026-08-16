<script lang="ts">
  import type { ImportResult } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Card from '$lib/components/ui/card'
  import { t } from '../lib/i18n.svelte'

  let {
    selectedBackupName,
    backupPreview,
    installed,
    canInstall,
    onExport,
    onSelectBackup,
    onRestore,
    onInstall,
  }: {
    selectedBackupName: string
    backupPreview: ImportResult | null
    installed: boolean
    canInstall: boolean
    onExport: () => void | Promise<void>
    onSelectBackup: (event: Event) => void | Promise<void>
    onRestore: () => void | Promise<void>
    onInstall: () => void | Promise<void>
  } = $props()
</script>

<div id="backup-panel" role="tabpanel" aria-labelledby="backup-heading">
  <Card.Root>
    <Card.Header><Card.Title id="backup-heading">{t('backupAndInstall')}</Card.Title></Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <Button type="button" onclick={onExport}>{t('exportJsonBackup')}</Button>
      <div class="flex flex-col gap-2">
        <Label for="backup-file">{t('importJsonBackup')}</Label>
        <Input id="backup-file" class="sr-only" type="file" accept="application/json,.json" onchange={onSelectBackup} />
        <label
          for="backup-file"
          class="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-within:ring-3 focus-within:ring-ring/30"
        >
          {t('chooseBackupFile')}
        </label>
        <p class="text-sm text-muted-foreground" aria-live="polite">
          {selectedBackupName || t('jsonFilesOnly')}
        </p>
      </div>
      {#if backupPreview}
        <p role="status">
          {t('readyToMerge')} <strong class="font-semibold">{backupPreview.data.foods.length}</strong> {t('foodsPlural')}
          {t('and')} <strong class="font-semibold">{backupPreview.data.mealEntries.length}</strong> {t('meals')}.
        </p>
        <Button type="button" onclick={onRestore}>{t('restoreBackup')}</Button>
      {/if}
      {#if installed}
        <p class="text-sm text-muted-foreground">{t('appInstalled')}</p>
      {:else if canInstall}
        <Button type="button" onclick={onInstall}>{t('installApp')}</Button>
      {:else}
        <p class="text-sm text-muted-foreground">{t('installFromBrowserMenu')}</p>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
