# GeoJSON kaynakları

Harita verileri AI tarafından çizilmedi.

- `turkey-country.geojson`: TUR ADM0, Türkiye sınırı
- `turkey-provinces.geojson`: TUR ADM1, 81 il sınırı
- `turkey-districts.geojson`: TUR ADM2, KPSS açısından kritik ~326 ilçe sınırı (973'lük ham veriden budanmış; yalnızca Soru+ "İlçeler" konusunda, lazy-load ile yüklenir)
- `turkey-physical-features.geojson`: KPSS fiziki coğrafya marker verileri
- `turkey-economic-features.geojson`: KPSS ekonomik coğrafya temsil noktaları

Kaynak: geoBoundaries / OpenStreetMap
Lisans: geoBoundaries verileri Creative Commons Attribution-ShareAlike 2.0, OpenStreetMap verileri ODbL 1.0 kapsamındadır.

İndirilen sürüm:

- https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM0/geoBoundaries-TUR-ADM0_simplified.geojson
- https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM1/geoBoundaries-TUR-ADM1_simplified.geojson
- https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM2/geoBoundaries-TUR-ADM2_simplified.geojson

İlçe veri notu:

ADM2 seviyesinde `shapeISO` alanı boştur, bu yüzden ilçe kimliği `shapeID` üzerinden kurulur. `shapeName` iller arasında benzersiz değildir (ör. birden fazla ilde "Merkez" adlı ilçe vardır); UI'da ilçe adı tek başına gösterilir (il adı parantezle eklenmez), bu yüzden budama sonrası çakışma riski düşük tutulmaya çalışılır.

`turkey-districts.geojson`, ham 973 ilçelik ADM2 verisinden `node scripts/pruneCriticalDistricts.mjs` ile budanmıştır — yalnızca (a) bir ilin ağırlık merkezinin içine düştüğü ilçe ("merkez ilçe") ve (b) `turkey-physical-features.geojson`/`turkey-economic-features.geojson` içindeki en az bir noktayı barındıran ilçeler tutulur. İlçe→il eşlemesi ve ilçe komşuluk verisi `node scripts/buildDistrictNeighbors.mjs` ile üretilir (çıktı: `src/geojson/districtNeighbors.ts`).

Baştan üretmek için:
1. Ham ADM2 dosyasını yeniden indirin: `curl -L -o public/geojson/turkey-districts.geojson "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM2/geoBoundaries-TUR-ADM2_simplified.geojson"` (973 ilçe olmalı — script zaten budanmış bir dosya bulursa hata verip durur).
2. `node scripts/pruneCriticalDistricts.mjs` (kritik alt kümeye budar, dosyanın üzerine yazar).
3. `node scripts/buildDistrictNeighbors.mjs` (il eşlemesi + komşuluk verisini yeniden üretir).

`turkey-districts.geojson` veya `turkey-provinces.geojson`/fiziki/ekonomik veri dosyaları değiştiğinde bu adımlar yeniden çalıştırılmalıdır.

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
