<script lang="ts">
  import * as Card from '$lib/components/ui/card'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import { t } from '../lib/i18n.svelte'
  import { refreshApp } from '../lib/service-worker'
</script>

<div id="advanced-panel" role="tabpanel" aria-labelledby="advanced-heading">
  <Card.Root class="p-0 overflow-hidden">
    <Card.Content class="p-0">
      <button type="button" class="flex h-14 w-full items-center gap-3 text-left" onclick={() => refreshApp()}>
        <RefreshCwIcon aria-hidden="true" class="size-5 text-muted-foreground" />
        <span class="flex-1 text-lg">{t('refreshApp')}</span>
      </button>
    </Card.Content>
  </Card.Root>
</div>
