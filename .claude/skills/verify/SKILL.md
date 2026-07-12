---
name: verify
description: KPSS Coğrafya Atlas'ı telefon görünümünde uçtan uca sürüp doğrulama reçetesi
---

# Doğrulama reçetesi (mobil-only SPA)

Uygulama **yalnızca mobil** hedefler; doğrulama telefon viewport'unda yapılır.

## Kurulum + sürüş

```bash
npm run dev          # 127.0.0.1:5173 (arka planda)
npm run build        # tsc strict — her değişiklik sonrası kapı
```

Tarayıcı otomasyonu: makinede Chrome yok; Playwright'ı geçici dizine kur
(kalıcı bağımlılık ekleme):

```bash
cd <scratchpad> && npm init -y
PLAYWRIGHT_BROWSERS_PATH=./pw-browsers npm i playwright
PLAYWRIGHT_BROWSERS_PATH=./pw-browsers npx playwright install chromium  # ~95 MB headless shell
```

Context ayarları: `viewport 390x844, deviceScaleFactor 2, hasTouch: true, isMobile: true`.

## Sürülecek akışlar

1. **Harita**: uzak zoom'da markerlar küçük (`.turkey-map--far`), +1 zoom'da büyür; il dokunuşu → popup; `Katmanlar` FAB → sheet açılır, çip toggle, backdrop ile kapanır. Dikkat: katman filtresi Soru+ havuzunu da daraltır (kapatılan konunun soru sayısı 0 olur).
2. **Soru+**: konu çipi "İller" → deterministik `choice` sorusu (pin görünür alana fit edilmeli); Soru Tipi select'i `mapLocate`/`pickOne` değerleriyle tür zorlanabilir. Cevap → sheet half'e iner, kalıcı tooltip'ler, AutoAdvanceBar, 3sn sonra yeni soru. Soru ortasında sekme değiştirme soruyu temiz kapatmalı.
3. **Sheet mekaniği**: tutamaçtan sürükleme peek/half/full snap'ler; gövde içeriği her snap'te erişilebilir olmalı (tab bar arkasına taşmamalı — `--sheet-hidden` mekanizması).
4. **Test** ve **Profil** sekmeleri + 1280px geniş viewport (içerik ~480px ortalanır, harita tam).

## Bilinen tuzaklar

- `tap()` yerine handle-drag için `page.mouse.down/move/up` kullan (framer-motion pointer tabanlı).
- Kalıcı Leaflet tooltip sayısını `document.querySelectorAll(".leaflet-tooltip").length` ile doğrula — TurkeyMap quiz effect'inin dizi prop'ları memoize edilmezse her render'da sök-tak yapar ve kopya sızdırır (App.tsx'te `plusTargetsForMap` vb. useMemo'lar bunun için var).
- `maxBounds` (PAN_BOUNDS) fitBounds padding'iyle çelişebilir: Leaflet merkez kelepçesi padding'i tanımaz; dikey ekranda soru hedefi sheet altında kalıyorsa PAN_BOUNDS güney sınırını kontrol et.
