// ponytail: native window.BarcodeDetector is unreliable on iOS Safari
// (confirmed via device testing — detect() always returned zero results even
// against a valid, well-lit, correctly-sized QR code, across hundreds of
// frames). This ponyfills the same API with a real WASM decoder (ZXing-C++)
// instead of depending on each browser's often-absent or broken native
// implementation.
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// Self-host the .wasm binary (bundled by Vite as a same-origin asset) instead
// of the library's jsDelivr CDN default — the default would require a network
// request (and fail entirely offline), violating this app's no-network,
// local-only architecture (see ADR 0002).
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingReaderWasmUrl : prefix + path),
  },
})

export { BarcodeDetector }
