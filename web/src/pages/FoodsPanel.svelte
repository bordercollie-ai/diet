<script lang="ts">
  import { decodeFoodShareCode, roundForDisplay, type AppData, type Food } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import { Textarea } from '$lib/components/ui/textarea'
  import * as Dialog from '$lib/components/ui/dialog'
  import CameraIcon from '@lucide/svelte/icons/camera'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import QrCodeIcon from '@lucide/svelte/icons/qr-code'
  import StarIcon from '@lucide/svelte/icons/star'
  import { onDestroy, tick } from 'svelte'
  import { foodName, t } from '../lib/i18n.svelte'
  import { BarcodeDetector } from '../lib/qr-scanner'

  let {
    data,
    onAddFood,
    onEditFood,
    onImportFood,
  }: {
    data: AppData
    onAddFood: () => void
    onEditFood: (id: string) => void
    onImportFood: (input: Omit<Food, 'id' | 'source' | 'updatedAt'>) => void | Promise<void>
  } = $props()

  const displayNumber = roundForDisplay

  const customFoods = $derived(
    data.foods
      .filter((food) => food.source === 'user')
      .toSorted((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
  )

  // Importing a shared custom food, by camera (QR decoder — see
  // docs/prd.md "自定义食品分享") or by pasting the same text code, so it
  // also works on browsers/devices without a usable camera.
  let importDialogOpen = $state(false)
  let pastedCode = $state('')
  let importError = $state('')
  let videoEl: HTMLVideoElement | undefined = $state()
  let scanning = $state(false)
  let stream: MediaStream | null = null
  let scanFrame = 0
  let scanFeedback = $state('')

  function openImport() {
    pastedCode = ''
    importError = ''
    importDialogOpen = true
  }

  function closeImport() {
    stopScan()
    importDialogOpen = false
  }

  $effect(() => {
    if (!importDialogOpen) stopScan()
  })

  async function importCode(code: string) {
    try {
      await onImportFood(decodeFoodShareCode(code))
      closeImport()
    } catch {
      importError = t('invalidShareCode')
    }
  }

  function importPastedCode() {
    void importCode(pastedCode)
  }

  async function startScan() {
    importError = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Request a high resolution so the camera can resolve fine QR
        // modules; the browser's own default (often 480x640) is too coarse
        // for a dense QR code shown on another screen.
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
    } catch {
      importError = t('cameraUnavailable')
      return
    }
    // The <video> only exists once `scanning` is true (it's behind an {#if}),
    // so flip that first and wait a tick for it to mount before binding the stream.
    scanning = true
    await tick()
    if (!videoEl) return
    videoEl.srcObject = stream
    await videoEl.play()
    const detector = new BarcodeDetector({ formats: ['qr_code'] })
    let consecutiveFailures = 0
    const detectFrame = async () => {
      if (!scanning || !videoEl) return
      if (videoEl.videoWidth && videoEl.videoHeight) {
        try {
          const [barcode] = await detector.detect(videoEl)
          if (barcode?.rawValue) {
            // Pause on a recognized code for a moment so the user gets visual
            // confirmation the scan worked, instead of it vanishing instantly.
            scanFeedback = t('qrRecognized')
            await new Promise((resolve) => setTimeout(resolve, 1000))
            void importCode(barcode.rawValue)
            return
          }
          consecutiveFailures = 0
        } catch (cause) {
          // Surface a persistent detect() failure (as opposed to "just hasn't
          // found a code yet") instead of spinning silently forever.
          if (++consecutiveFailures === 10) {
            importError = cause instanceof Error ? cause.message : t('cameraUnavailable')
          }
        }
      }
      // ponytail: WASM decoding is real CPU work (unlike a native call), so
      // poll a few times a second rather than every animation frame.
      scanFrame = window.setTimeout(detectFrame, 200)
    }
    detectFrame()
  }

  function stopScan() {
    scanning = false
    scanFeedback = ''
    window.clearTimeout(scanFrame)
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  onDestroy(stopScan)
</script>

<div id="foods-panel" role="tabpanel" aria-labelledby="foods-tab">
  <div class="grid grid-cols-2 gap-2">
    <Button type="button" onclick={onAddFood}>
      <PlusIcon aria-hidden="true" />
      {t('addFood')}
    </Button>
    <Button type="button" variant="outline" onclick={openImport}>
      <QrCodeIcon aria-hidden="true" />
      {t('importFood')}
    </Button>
  </div>

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

  <Dialog.Root bind:open={importDialogOpen}>
    <Dialog.Content class="top-[6%] max-h-[88vh] translate-y-0 grid gap-4 overflow-y-auto">
      <Dialog.Header>
        <Dialog.Title>{t('importFood')}</Dialog.Title>
      </Dialog.Header>
      {#if scanning}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={videoEl} class="aspect-square max-h-56 w-full rounded-md bg-black object-cover" muted playsinline></video>
        {#if scanFeedback}<p class="text-sm font-medium text-green-600 dark:text-green-400">{scanFeedback}</p>{/if}
        <Button type="button" variant="outline" onclick={stopScan}>{t('stopCamera')}</Button>
      {:else}
        <Button type="button" onclick={startScan}>
          <CameraIcon aria-hidden="true" />
          {t('scanQrCode')}
        </Button>
      {/if}
      <div class="grid gap-2">
        <label for="import-food-code" class="text-sm font-medium">{t('pasteShareCode')}</label>
        <Textarea id="import-food-code" bind:value={pastedCode} rows={3} class="font-mono text-xs" />
        <Button type="button" onclick={importPastedCode} disabled={!pastedCode.trim()}>{t('import')}</Button>
      </div>
      {#if importError}
        <p role="alert" class="text-sm text-destructive">{importError}</p>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
</div>
