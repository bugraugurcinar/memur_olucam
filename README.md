🗺️ KPSS Coğrafya Atlas

AI Development Blueprint & Technical Roadmap

Version: 1.0
Status: Planning
Primary Goal: Build the best interactive map-based learning platform for KPSS Geography.

⸻

1. Project Vision

Bu proje bir soru bankası değildir.

Bu proje bir harita uygulaması değildir.

Bu proje bir ezber uygulaması değildir.

Bu proje, KPSS Coğrafya müfredatını mekânsal hafıza kullanarak öğreten interaktif bir öğrenme platformudur.

Amaç;

* KPSS coğrafya konularını harita üzerinde öğretmek
* Ezberi azaltmak
* Görsel hafızayı geliştirmek
* Yanlış yapılan konuları tekrar ettirmek
* Öğrenmeyi oyunlaştırmak

Bu projenin kapsamı yalnızca KPSS Coğrafya ile sınırlıdır.

⸻

2. Project Scope

Dahil

* Türkiye Fiziki Coğrafyası
* Türkiye Beşeri Coğrafyası
* Türkiye Ekonomik Coğrafyası
* KPSS’de çıkan tüm coğrafya konuları

Dahil Değil

* Dünya Coğrafyası
* TYT
* AYT
* LGS
* Tarih
* Vatandaşlık

Bu projede AI kapsamı genişletmeye çalışmamalıdır.

⸻

3. Learning Philosophy

Uygulamanın temel mantığı:

Bilgiyi okumak yerine harita üzerinde kullanmak.

Örnek:

❌ Van Gölü nerededir?

✔ Van Gölünü haritada işaretle.

⸻

❌ Bor hangi ildedir?

✔ Haritada Bor madeninin bulunduğu ili seç.

⸻

Her soru mümkün olduğunca harita etkileşimi içermelidir.

⸻

4. KPSS Topics

Uygulama aşağıdaki modüllerden oluşacaktır.

Fiziki Coğrafya

* Dağlar
* Ovalar
* Platolar
* Akarsular
* Göller
* Boğazlar
* Körfezler
* Burunlar
* Adalar
* Delta Ovaları
* Dağ sıraları
* Yükselti

⸻

İklim

* İklim bölgeleri
* Yağış tipleri
* Rüzgarlar
* Yerel rüzgarlar

⸻

Bitki Örtüsü

* Orman
* Maki
* Garig
* Psödomaki
* Bozkır
* Alpin çayırlar

⸻

Ekonomik Coğrafya

* Madenler
* Sanayi
* Enerji kaynakları
* Tarım ürünleri
* Hayvancılık
* Turizm
* Limanlar

⸻

Nüfus

* Yoğunluk
* Göç
* Yerleşme

⸻

5. Architecture

Application

↓

Map Engine

↓

Question Engine

↓

Learning Engine

↓

Statistics Engine

↓

Local Storage

↓

GeoJSON

Her sistem birbirinden bağımsız geliştirilecektir.

⸻

6. Folder Structure

Her klasör tek sorumluluk ilkesine göre oluşturulacaktır.

components/

UI bileşenleri

maps/

Harita bileşenleri

questions/

Soru sistemi

hooks/

Custom Hook

store/

Zustand Store

geojson/

Harita verileri

questions/

Soru JSON dosyaları

⸻

7. GeoJSON Standards

Harita AI tarafından çizilmeyecek.

Sadece gerçek GeoJSON kullanılacaktır.

Polygon

* İller
* Göller
* Ovalar
* Platolar
* İklim bölgeleri

LineString

* Akarsular
* Fay hatları

Marker

* Dağ zirveleri
* Madenler
* Sanayi merkezleri
* Limanlar

⸻

8. Naming Convention

river_kizilirmak

lake_van

mountain_agri

mine_bor_eskisehir

plain_cukurova

plateau_obruk

Her obje benzersiz ID taşımalıdır.

⸻

9. Question Engine

Her soru aşağıdaki yapıda olacaktır.

* id
* category
* title
* answer
* geometry
* difficulty
* explanation
* hint
* source
* tags

Örnek:

Van Gölünü haritada işaretle.

Kategori

Göller

Zorluk

Kolay

⸻

10. Question Types

Haritada Bul

Haritada İşaretle

İl Seç

Doğru Yanlış

Çoktan Seçmeli

Boş Harita

Eşleştirme

Sürükle Bırak

Hız Modu

Mini Quiz

Her yeni özellik mevcut soru tiplerinden birine uygun olmalıdır.

⸻

11. Learning Engine

Amaç;

Yanlış yapılan bilgileri tekrar ettirmek.

Kullanılacak sistem:

* Spaced Repetition
* Wrong Answer Tracking
* Confidence Score

AI yeni algoritmalar eklemeden önce mevcut yapıyı korumalıdır.

⸻

12. Statistics

Gösterilecek bilgiler

* Günlük çalışma
* Haftalık çalışma
* Toplam soru
* Doğru
* Yanlış
* Başarı yüzdesi
* En iyi konu
* En kötü konu
* Çalışma serisi

⸻

13. Game System

XP

Level

Rozet

Başarılar

Günlük hedef

Haftalık hedef

Animasyonlar

Amaç motivasyonu artırmaktır.

⸻

14. UI Rules

Tasarım sade olmalıdır.

Harita her zaman ekranın odak noktasıdır.

Kartlar haritanın önüne geçmemelidir.

Mobil öncelikli geliştirme yapılacaktır.

Dark Mode desteklenecektir.

⸻

15. AI Development Rules

AI MUST

* TypeScript kullan.
* Kodu modüler yaz.
* Componentleri yeniden kullanılabilir tasarla.
* Performansı önceliklendir.
* Responsive tasarla.
* Açıklayıcı isimler kullan.
* Kod tekrarından kaçın.
* Her yeni özellik mevcut mimariye uygun olmalı.

AI MUST NOT

* Harita üretme.
* Rastgele koordinat oluşturma.
* GeoJSON verisini değiştirme.
* Hardcoded veri yazma.
* Tek dosyada yüzlerce satır kod yazma.
* Gereksiz bağımlılık ekleme.
* Mevcut mimariyi bozacak refactor yapma.

⸻

16. Development Roadmap

Phase 1

* Proje kurulumu
* Harita altyapısı
* Türkiye sınırı
* İl sınırları

Phase 2

* Katman sistemi
* Akarsular
* Göller
* Dağlar

Phase 3

* Soru motoru
* Harita etkileşimi
* Doğru / yanlış sistemi

Phase 4

* Adaptif öğrenme
* İstatistikler
* XP sistemi

Phase 5

* Performans optimizasyonu
* Mobil iyileştirmeleri
* PWA desteği

Her faz tamamlanmadan sonraki faza geçilmemelidir.

⸻

17. Definition of Done

Bir özellik tamamlanmış sayılması için:

* Çalışıyor olmalı.
* Responsive olmalı.
* Dark Mode desteklemeli.
* TypeScript hatası olmamalı.
* Mevcut mimariyi bozmamalı.
* Gerekirse dokümantasyonu güncellenmeli.

⸻

18. Success Criteria

Proje başarılı sayılabilmesi için kullanıcı:

* Harita üzerinde aktif çalışabilmeli.
* En zayıf olduğu konuları görebilmeli.
* Yanlış yaptığı soruları tekrar çözebilmeli.
* KPSS coğrafya müfredatını yalnızca bu uygulamayı kullanarak tekrar edebilmelidir.

⸻

19. Final Principle

Her geliştirme kararında şu soru sorulmalıdır:

“Bu özellik KPSS coğrafya öğrencisinin bilgiyi daha kalıcı öğrenmesine gerçekten katkı sağlıyor mu?”

Eğer cevap hayır ise, o özellik projeye eklenmemelidir.

⸻

20. Development Setup

Kurulum

```bash
npm install
```

Geliştirme sunucusu

```bash
npm run dev
```

Üretim kontrolü

```bash
npm run build
```

⸻

21. Phase Status

Phase 1

Tamamlandı.

* Vite + React + TypeScript proje kurulumu
* Leaflet tabanlı harita altyapısı
* Türkiye sınırı GeoJSON katmanı
* 81 il sınırı GeoJSON katmanı
* Responsive ve dark mode uyumlu ilk ekran
