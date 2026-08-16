<script lang="ts">
  import SwipeLayer from '../../src/lib/components/swipe-layer.svelte'

  let { onBack }: { onBack: () => void } = $props()
</script>

<SwipeLayer {onBack}>
  {#snippet back()}<div>Back content</div>{/snippet}
  {#snippet front()}<div>Front content</div>{/snippet}
</SwipeLayer>
