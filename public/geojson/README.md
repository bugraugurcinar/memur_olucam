# GeoJSON kaynakları

Harita verileri AI tarafından çizilmedi.

- `turkey-country.geojson`: TUR ADM0, Türkiye sınırı
- `turkey-provinces.geojson`: TUR ADM1, 81 il sınırı
- `turkey-physical-features.geojson`: KPSS fiziki coğrafya marker verileri
- `turkey-economic-features.geojson`: KPSS ekonomik coğrafya temsil noktaları

Kaynak: geoBoundaries / OpenStreetMap
Lisans: geoBoundaries verileri Creative Commons Attribution-ShareAlike 2.0, OpenStreetMap verileri ODbL 1.0 kapsamındadır.

İndirilen sürüm:

- https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM0/geoBoundaries-TUR-ADM0_simplified.geojson
- https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM1/geoBoundaries-TUR-ADM1_simplified.geojson

Fiziki veri notu:

Fiziki yer şekli marker koordinatları AI tarafından üretilmedi. `turkey-physical-features.geojson` içindeki her feature kendi kaynak kaydını `sourceName`, `sourceUrl`, `sourceQuery` ve `sourceDisplayName` alanlarında taşır.

Ekonomik veri notu:

Ekonomik coğrafya markerları istatistiksel üretim payı veya resmi sıralama verisi değildir. KPSS müfredatında harita/eşleştirme için kullanılan temsil noktalarıdır. Her feature kendi kaynak/temsil bilgisini `sourceName`, `sourceUrl`, `sourceQuery` ve `sourceDisplayName` alanlarında taşır.

Veri üretimi ve doğrulama:

```bash
node scripts/buildPhysicalFeatures.mjs
node scripts/buildEconomicFeatures.mjs
npm run validate:data
```
