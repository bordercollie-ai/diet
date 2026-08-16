<script lang="ts">
  import * as Card from '$lib/components/ui/card'
  import { t } from '../lib/i18n.svelte'

  const repoUrl = 'https://github.com/bordercollie-ai/diet'
</script>

<div id="about-panel" role="tabpanel" aria-labelledby="about-heading">
  <Card.Root>
    <Card.Header><Card.Title id="about-heading">{t('about')}</Card.Title></Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <a
        href={repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 text-sm text-primary underline underline-offset-4"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="size-5 shrink-0 fill-current">
          <path
            d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.55v-2.17c-3.2.7-3.87-1.35-3.87-1.35-.53-1.32-1.29-1.68-1.29-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.44-2.28 1.17-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.14 1.18a10.9 10.9 0 0 1 5.72 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.73.8 1.17 1.83 1.17 3.08 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .3.21.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
          />
        </svg>
        <span>{t('sourceCode')}: {repoUrl}</span>
      </a>
      <p class="text-sm text-muted-foreground">{t('build')} {__BUILD_TIME__}</p>
    </Card.Content>
  </Card.Root>
</div>
