import fs from "node:fs/promises";
import { physicalFeatureCoordinateCorrections } from "./physicalFeatureCorrections.mjs";

const outputPath = new URL("../public/geojson/turkey-physical-features.geojson", import.meta.url);
const cachePath = new URL("file:///tmp/kpss-physical-feature-geocoding-cache-v2.json");
const geocodeCache = await loadCache();

const topicLabels = {
  mountain: "Dağlar",
  plain: "Ovalar",
  plateau: "Platolar",
  river: "Akarsular",
  lake: "Göller",
  coast: "Kıyı Tipleri",
};

const categoryLabels = {
  mountain_fault_block: "Kırık dağ",
  mountain_fold: "Kıvrım dağı",
  mountain_volcanic: "Volkanik dağ",
  mountain_plutonic: "İç püskürük (Batolit) dağ",
  plain_delta: "Delta ovası",
  plain_karstic: "Karstik ova",
  plain_tectonic: "Tektonik ova",
  plateau_erosion: "Aşınım platosu",
  plateau_karstic: "Karstik plato",
  plateau_volcanic_lava: "Volkanik lav platosu",
  plateau_horizontal: "Tabaka düzlüğü platosu",
  river_black_sea: "Karadeniz'e dökülen akarsu",
  river_marmara: "Marmara'ya dökülen akarsu",
  river_aegean: "Ege'ye dökülen akarsu",
  river_mediterranean: "Akdeniz'e dökülen akarsu",
  river_persian_gulf: "Basra Körfezi'ne dökülen akarsu",
  river_caspian: "Hazar Denizi'ne dökülen akarsu",
  lake_tectonic: "Tektonik göl",
  lake_karstic: "Karstik göl",
  lake_volcanic: "Volkanik göl",
  lake_landslide_dam: "Heyelan set gölü",
  lake_coastal_barrier: "Kıyı set gölü",
  lake_alluvial_dam: "Alüvyal set gölü",
  lake_volcanic_dam: "Volkanik set gölü",
  coast_boyuna: "Boyuna kıyı tipi",
  coast_enine: "Enine kıyı tipi",
  coast_ria: "Ria kıyı tipi",
  coast_dalmatian: "Dalmaçya kıyı tipi",
  coast_limanli: "Limanlı kıyı tipi",
  coast_calankli: "Kalanklı kıyı tipi",
};

const topicPrefix = {
  mountain: "mountain",
  plain: "plain",
  plateau: "plateau",
  river: "river",
  lake: "lake",
  coast: "coast",
};

const features = [];

function slugify(value) {
  const replacements = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    I: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };

  return value
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (letter) => replacements[letter])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function loadCache() {
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {
    return {};
  }
}

async function saveCache() {
  await fs.writeFile(cachePath, `${JSON.stringify(geocodeCache, null, 2)}\n`);
}

function queryBase(name) {
  return name
    .replace(/\([^)]*\)/g, "")
    .replace(/\bDağları\b/g, "")
    .replace(/\bDağı\b/g, "")
    .replace(/\bOvası\b/g, "")
    .replace(/\bPlatosu\b/g, "")
    .replace(/\bGölü\b/g, "")
    .replace(/\bÇayı\b/g, "")
    .replace(/\bNehri\b/g, "")
    .trim();
}

function toItem(item) {
  return typeof item === "string" ? { name: item } : item;
}

function addGroup({ topic, category, region, items, note }) {
  for (const rawItem of items) {
    const item = toItem(rawItem);
    const name = item.name;
    const id = item.id ?? `${topicPrefix[topic]}_${slugify(item.idName ?? name)}`;
    const searchName = item.searchName ?? name;
    const stripped = queryBase(searchName);
    const defaultQueries = [
      `${searchName}, Türkiye`,
      `${searchName}, ${region}, Türkiye`,
      stripped && stripped !== searchName ? `${stripped}, Türkiye` : null,
      stripped && stripped !== searchName ? `${stripped}, ${region}, Türkiye` : null,
    ].filter(Boolean);

    features.push({
      id,
      name,
      topic,
      topicLabel: topicLabels[topic],
      category,
      categoryLabel: categoryLabels[category],
      region,
      location: item.location ?? region,
      kpssNote:
        item.note ??
        note ??
        `${categoryLabels[category]} olarak ${region} içinde KPSS fiziki coğrafya çalışmasına eklenir.`,
      queries: item.queries ?? defaultQueries,
    });
  }
}

addGroup({
  topic: "mountain",
  category: "mountain_fault_block",
  region: "Ege",
  items: [
    { name: "Kaz Dağları", searchName: "Kaz Dağı" },
    "Madra Dağı",
    "Yunt Dağı",
    "Bozdağlar",
    "Aydın Dağları",
    "Menteşe Dağları",
  ],
});

addGroup({
  topic: "mountain",
  category: "mountain_fault_block",
  region: "Akdeniz",
  items: [{ name: "Amanos (Nur) Dağları", searchName: "Amanos Dağları", queries: ["Amanos Dağları, Hatay, Türkiye", "Nur Dağları, Hatay, Türkiye"] }],
});

addGroup({
  topic: "mountain",
  category: "mountain_fold",
  region: "Marmara",
  items: [
    { name: "Yıldız (Istranca) Dağları", searchName: "Istranca Dağları" },
    { name: "Koru Dağları", queries: ["Koru Damları, Gelibolu, Türkiye", "Koru Düzü, Gelibolu, Türkiye"] },
    { name: "Biga Dağları", queries: ["Biga, Çanakkale, Türkiye"] },
    "Samanlı Dağları",
  ],
});

addGroup({
  topic: "mountain",
  category: "mountain_fold",
  region: "Karadeniz",
  items: [
    "Küre Dağları",
    "Ilgaz Dağları",
    "Köroğlu Dağları",
    "Canik Dağları",
    "Giresun Dağları",
    "Kaçkar Dağları",
    "Mescit Dağları",
    "Kop Dağı",
    "Yalnızçam Dağları",
  ],
});

addGroup({
  topic: "mountain",
  category: "mountain_fold",
  region: "Akdeniz",
  items: ["Bey Dağları", "Geyik Dağları", "Sultan Dağları", "Bolkar Dağları", "Aladağlar", "Tahtalı Dağları", "Binboğa Dağları"],
});

addGroup({
  topic: "mountain",
  category: "mountain_fold",
  region: "Doğu Anadolu",
  items: [
    { name: "Munzur (Mercan) Dağları", searchName: "Munzur Dağları" },
    "Palandöken Dağları",
    "Bingöl Dağları",
    "Allahuekber Dağları",
    { name: "Cilo (Buzul) Dağları", searchName: "Cilo Dağı" },
  ],
});

addGroup({
  topic: "mountain",
  category: "mountain_volcanic",
  region: "İç Anadolu",
  items: [
    { name: "Karadağ", id: "mountain_karadag_karaman", queries: ["Karadağ, Karaman, Türkiye"] },
    { name: "Karacadağ", id: "mountain_karacadag_ic_anadolu", queries: ["Karacadağ Karapınar Konya Türkiye", "Karacadağ Vulkanregion Karapınar"] },
    { name: "Hasandağı", searchName: "Hasan Dağı" },
    "Melendiz Dağı",
    "Erciyes Dağı",
  ],
});

addGroup({
  topic: "mountain",
  category: "mountain_volcanic",
  region: "Doğu Anadolu",
  items: [
    { name: "Nemrut", searchName: "Nemrut Dağı", queries: ["Nemrut Dağı, Bitlis, Türkiye"] },
    "Süphan Dağı",
    "Tendürek Dağı",
    { name: "Büyük Ağrı", searchName: "Ağrı Dağı" },
    { name: "Küçük Ağrı", searchName: "Küçük Ağrı Dağı" },
  ],
});

addGroup({
  topic: "mountain",
  category: "mountain_volcanic",
  region: "Güneydoğu Anadolu",
  items: [{ name: "Karacadağ", id: "mountain_karacadag_guneydogu", queries: ["Karacadağ, Diyarbakır, Türkiye", "Karacadağ, Şanlıurfa, Türkiye"] }],
});

addGroup({
  topic: "mountain",
  category: "mountain_volcanic",
  region: "Ege",
  items: [{ name: "Kula Tepeleri", searchName: "Kula Volkanik Jeoparkı", queries: ["Kula Volkanik Jeoparkı, Manisa, Türkiye", "Kula, Manisa, Türkiye"] }],
});

addGroup({
  topic: "mountain",
  category: "mountain_plutonic",
  region: "Marmara",
  items: [
    {
      name: "Uludağ",
      note: "Uludağ volkanik bir dağ değildir: derinlik volkanizması sonucu oluşan granit bir batolittir (iç püskürük). KPSS'de volkanik dağlar listesine dahil edilmemesi gereken klasik bir tuzak sorudur.",
    },
  ],
});

addGroup({
  topic: "plain",
  category: "plain_delta",
  region: "Karadeniz",
  items: ["Bafra Ovası", "Çarşamba Ovası"],
});

addGroup({
  topic: "plain",
  category: "plain_delta",
  region: "Ege",
  items: [
    { name: "Dikili Ovası", note: "Bakırçay deltası çevresindeki ova olarak çalışılır." },
    { name: "Menemen Ovası", note: "Gediz deltası çevresindeki ova olarak çalışılır." },
    { name: "Selçuk Ovası", note: "Küçük Menderes deltası çevresindeki ova olarak çalışılır." },
    { name: "Balat Ovası", note: "Büyük Menderes deltası çevresindeki ova olarak çalışılır." },
  ],
});

addGroup({
  topic: "plain",
  category: "plain_delta",
  region: "Akdeniz",
  items: [
    { name: "Çukurova", note: "Seyhan ve Ceyhan nehirlerinin oluşturduğu büyük delta ovasıdır." },
    { name: "Silifke Ovası", note: "Göksu deltası çevresindeki ova olarak çalışılır." },
  ],
});

addGroup({
  topic: "plain",
  category: "plain_karstic",
  region: "Akdeniz",
  items: ["Tefenni Ovası", "Acıpayam Ovası", "Korkuteli Ovası", "Kestel Ovası", "Elmalı Ovası", { name: "Muğla Ovası", queries: ["Muğla, Muğla, Türkiye"] }, "Çivril Ovası", "Tavas Ovası"],
});

addGroup({
  topic: "plain",
  category: "plain_tectonic",
  region: "Marmara",
  items: ["Ergene Ovası", { name: "Bursa Ovası", queries: ["Bursa, Bursa, Türkiye"] }, "Karacabey Ovası", "Adapazarı Ovası", "İnegöl Ovası"],
});

addGroup({
  topic: "plain",
  category: "plain_tectonic",
  region: "Ege",
  items: [{ name: "Soma Ovası", queries: ["Soma, Manisa, Türkiye"] }, "Kırkağaç Ovası", "Akhisar Ovası", "Turgutlu Ovası", "Salihli Ovası", "Alaşehir Ovası", "Torbalı Ovası", "Ödemiş Ovası", { name: "Tire Ovası", queries: ["Tire, İzmir, Türkiye"] }, "Söke Ovası", "Nazilli Ovası"],
});

addGroup({
  topic: "plain",
  category: "plain_tectonic",
  region: "Karadeniz",
  items: ["Bolu Ovası", "Düzce Ovası", "Merzifon Ovası", "Suluova Ovası", "Taşova Ovası", "Erbaa Ovası", "Niksar Ovası", "Suşehri Ovası", "Boyabat Ovası"],
});

addGroup({
  topic: "plain",
  category: "plain_tectonic",
  region: "Doğu Anadolu",
  items: ["Pasinler Ovası", { name: "Erzurum Ovası", queries: ["Erzurum, Erzurum, Türkiye"] }, "Erzincan Ovası", "Tercan Ovası", "Malatya Ovası", { name: "Elazığ (Uluova)", searchName: "Uluova" }, "Muş Ovası", "Iğdır Ovası", "Yüksekova", "Bingöl Ovası"],
});

addGroup({
  topic: "plain",
  category: "plain_tectonic",
  region: "İç Anadolu",
  items: ["Konya Ovası", "Eskişehir Ovası", { name: "Kayseri (Develi) Ovası", searchName: "Develi Ovası" }, { name: "Ankara (Çubuk) Ovası", searchName: "Çubuk Ovası" }, { name: "Mürted (Akıncı) Ovası", searchName: "Mürted Ovası", queries: ["Akıncı Hava Üssü, Ankara, Türkiye", "Akıncı, Ankara, Türkiye"] }],
});

addGroup({
  topic: "plain",
  category: "plain_tectonic",
  region: "Güneydoğu Anadolu",
  items: [{ name: "Harran (Altınbaşak) Ovası", searchName: "Harran Ovası" }, "Ceylanpınar Ovası", "Suruç Ovası", "Birecik Ovası"],
});

addGroup({
  topic: "plateau",
  category: "plateau_erosion",
  region: "Marmara",
  items: [
    { name: "Çatalca - Kocaeli Platosu", searchName: "Çatalca Kocaeli Platosu", queries: ["Çatalca, İstanbul, Türkiye", "Kocaeli, Türkiye"] },
    {
      name: "Yıldız Platosu",
      location: "Trakya",
      note: "Trakya'nın kuzeyindeki aşınım yüzeyleri, Marmara'nın plato örnekleri içinde çalışılır.",
    },
  ],
});

addGroup({
  topic: "plateau",
  category: "plateau_erosion",
  region: "Karadeniz",
  items: [
    "Perşembe Platosu",
    {
      name: "Canik Platosu",
      location: "Orta Karadeniz",
      note: "Canik çevresindeki plato yüzeyleri, Karadeniz kıyı dağlarının gerisindeki aşınım alanlarıyla ilişkilendirilir.",
    },
  ],
});

addGroup({
  topic: "plateau",
  category: "plateau_karstic",
  region: "Akdeniz",
  items: [
    "Teke Platosu",
    "Taşeli Platosu",
    {
      name: "Göller Yöresi Platosu",
      location: "Isparta / Burdur",
      note: "Göller Yöresi, karstik arazi ve kapalı havza gölleriyle birlikte KPSS fiziki coğrafyasında çalışılır.",
    },
    {
      name: "Anamur Platosu",
      location: "Mersin",
      note: "Anamur çevresi, Taşeli karstik platosunun kıyıya yakın devamı olarak temsil edilir.",
    },
  ],
});

addGroup({
  topic: "plateau",
  category: "plateau_volcanic_lava",
  region: "Doğu Anadolu",
  items: [
    "Erzurum - Kars Platosu",
    "Ardahan Platosu",
    {
      name: "Ağrı Platosu",
      location: "Ağrı",
      note: "Doğu Anadolu'daki yüksek volkanik alanlar, lav platosu ve volkanik dağ ilişkisiyle birlikte öğrenilir.",
    },
    {
      name: "Tendürek çevresi lav platosu",
      location: "Ağrı / Van",
      note: "Tendürek çevresi, Doğu Anadolu'nun volkanik arazi örnekleri içinde lav örtüleriyle temsil edilir.",
    },
  ],
});

addGroup({
  topic: "plateau",
  category: "plateau_horizontal",
  region: "İç Anadolu",
  items: [{ name: "Haymana Platosu", location: "Ankara" }, { name: "Cihanbeyli Platosu", location: "Konya" }, { name: "Obruk Platosu", location: "Konya" }, { name: "Bozok Platosu", location: "Yozgat" }, { name: "Uzunyayla Platosu", location: "Sivas / Kayseri" }],
});

addGroup({
  topic: "plateau",
  category: "plateau_horizontal",
  region: "Güneydoğu Anadolu",
  items: ["Gaziantep Platosu", "Şanlıurfa Platosu", "Adıyaman Platosu"],
});

addGroup({
  topic: "plateau",
  category: "plateau_horizontal",
  region: "Ege",
  items: [{ name: "Yazılıkaya Platosu", location: "Afyon / Eskişehir" }],
});

addGroup({
  topic: "river",
  category: "river_black_sea",
  region: "Karadeniz",
  items: [
    { name: "Çoruh Nehri", queries: ["Çoruh, Artvin, Türkiye", "Çoruh Vadisi, Artvin, Türkiye"] },
    "Yeşilırmak",
    "Kızılırmak",
    { name: "Filyos (Yenice)", searchName: "Filyos Çayı" },
    "Bartın Çayı",
    "Sakarya Nehri",
  ],
});

addGroup({
  topic: "river",
  category: "river_marmara",
  region: "Marmara",
  items: [
    "Susurluk Çayı",
    {
      name: "Gönen Çayı",
      note: "Gönen Çayı, Güney Marmara akarsuları içinde Marmara Denizi'ne ulaşan örneklerden biridir.",
    },
    {
      name: "Biga Çayı",
      note: "Biga Çayı, Marmara'ya dökülen akarsular içinde Çanakkale çevresiyle ilişkilendirilir.",
    },
    {
      name: "Nilüfer Çayı",
      note: "Nilüfer Çayı, Bursa Ovası ve Susurluk sistemi bağlantısıyla Marmara havzası içinde çalışılır.",
    },
  ],
});

addGroup({
  topic: "river",
  category: "river_aegean",
  region: "Ege",
  items: ["Meriç Nehri", "Bakırçay", "Gediz Nehri", "Küçük Menderes Nehri", "Büyük Menderes Nehri"],
});

addGroup({
  topic: "river",
  category: "river_mediterranean",
  region: "Akdeniz",
  items: ["Dalaman Çayı", "Eşen Çayı", "Aksu Çayı", "Köprüçay", "Manavgat Çayı", "Göksu Nehri", "Seyhan Nehri", "Ceyhan Nehri", "Asi Nehri"],
});

addGroup({
  topic: "river",
  category: "river_persian_gulf",
  region: "Basra Körfezi",
  items: [
    "Fırat Nehri",
    "Dicle Nehri",
    {
      name: "Murat Nehri",
      note: "Murat Nehri, Fırat'ın ana kollarından biri olarak Basra Körfezi dış havzasına bağlanır.",
    },
    {
      name: "Karasu Nehri",
      note: "Karasu, Fırat sisteminin kaynak kollarından biri olarak Türkiye'nin dışa akışlı havzaları içinde öğrenilir.",
    },
    {
      name: "Büyük Zap Suyu",
      note: "Büyük Zap Suyu, Dicle sistemi üzerinden Basra Körfezi havzasına bağlanan akarsu örneğidir.",
    },
  ],
});

addGroup({
  topic: "river",
  category: "river_caspian",
  region: "Hazar Denizi",
  items: [
    "Aras Nehri",
    "Kura Nehri",
    {
      name: "Arpaçay",
      note: "Arpaçay, Aras sistemi üzerinden Hazar Denizi havzasına bağlanan sınır akarsuyu örneğidir.",
    },
  ],
});

addGroup({
  topic: "lake",
  category: "lake_tectonic",
  region: "Türkiye",
  items: ["Tuz Gölü", "Sapanca Gölü", "İznik Gölü", { name: "Manyas (Kuş) Gölü", searchName: "Manyas Gölü" }, "Uluabat Gölü", "Hazar Gölü", "Akşehir Gölü", "Eber Gölü", "Burdur Gölü"],
});

addGroup({
  topic: "lake",
  category: "lake_karstic",
  region: "Türkiye",
  items: ["Salda Gölü", "Kestel Gölü", "Avlan Gölü", "Elmalı Gölü", "Suğla Gölü", { name: "Kızören", searchName: "Kızören Obruğu" }],
});

addGroup({
  topic: "lake",
  category: "lake_volcanic",
  region: "Türkiye",
  items: [{ name: "Nemrut (Kaldera)", searchName: "Nemrut Gölü" }, { name: "Meke Tuzlası (Maar)", searchName: "Meke Gölü" }, { name: "Acıgöl (Maar)", searchName: "Acıgöl Nevşehir" }, { name: "Gölcük (Maar)", searchName: "Gölcük Gölü Isparta" }],
});

addGroup({
  topic: "lake",
  category: "lake_landslide_dam",
  region: "Türkiye",
  items: ["Abant Gölü", "Yedigöller", "Sera Gölü", "Tortum Gölü", "Zinav Gölü", "Borabay Gölü"],
});

addGroup({
  topic: "lake",
  category: "lake_coastal_barrier",
  region: "Türkiye",
  items: [
    { name: "Büyük Çekmece", searchName: "Büyükçekmece Gölü" },
    { name: "Küçük Çekmece", searchName: "Küçükçekmece Gölü" },
    { name: "Terkos (Durusu)", searchName: "Terkos Gölü", queries: ["Terkos İstanbul Türkiye", "Terkos Barajı İstanbul Türkiye"] },
    "Akyatan Gölü",
  ],
});

addGroup({
  topic: "lake",
  category: "lake_alluvial_dam",
  region: "Türkiye",
  items: ["Eymir Gölü", "Mogan Gölü", { name: "Bafa (Çamiçi) Gölü", searchName: "Bafa Gölü" }, "Köyceğiz Gölü", "Marmara Gölü"],
});

addGroup({
  topic: "lake",
  category: "lake_volcanic_dam",
  region: "Türkiye",
  items: ["Van Gölü", "Erçek Gölü", "Nazik Gölü", "Haçlı Gölü", "Çıldır Gölü", { name: "Balık Gölü", queries: ["Balık Gölü, Ağrı, Türkiye", "Balık Gölü, Ardahan, Türkiye"] }],
});

addGroup({
  topic: "coast",
  category: "coast_boyuna",
  region: "Karadeniz",
  items: [{ name: "Karadeniz boyuna kıyıları", searchName: "Sinop" }],
  note: "Dağların kıyıya paralel uzandığı boyuna kıyı tipi olarak çalışılır.",
});

addGroup({
  topic: "coast",
  category: "coast_boyuna",
  region: "Akdeniz",
  items: [{ name: "Akdeniz boyuna kıyıları", searchName: "Mersin" }],
  note: "Dağların kıyıya paralel uzandığı boyuna kıyı tipi olarak çalışılır.",
});

addGroup({
  topic: "coast",
  category: "coast_enine",
  region: "Ege",
  items: [
    { name: "Ege enine kıyıları", searchName: "İzmir Körfezi" },
    {
      name: "Kuzey Ege enine kıyıları",
      searchName: "Edremit Körfezi",
      note: "Ege'de dağların kıyıya dik uzanması girintili çıkıntılı enine kıyı tipini oluşturur.",
    },
    {
      name: "Orta Ege enine kıyıları",
      searchName: "Kuşadası",
      note: "Kuşadası çevresi, Ege'nin enine kıyı karakterini haritada göstermek için temsil noktasıdır.",
    },
    {
      name: "Güney Ege enine kıyıları",
      searchName: "Bodrum",
      note: "Güney Ege kıyıları, dağların kıyıya dik uzanışı ve koy-körfez yapısıyla enine kıyı örneği olarak çalışılır.",
    },
  ],
  note: "Dağların kıyıya dik uzandığı enine kıyı tipi olarak çalışılır.",
});

addGroup({
  topic: "coast",
  category: "coast_ria",
  region: "Marmara",
  items: ["İstanbul Boğazı", "Çanakkale Boğazı", "Haliç"],
});

addGroup({
  topic: "coast",
  category: "coast_ria",
  region: "Ege",
  items: [
    { name: "Gökova Körfezi", note: "Muğla Menteşe çevresindeki ria kıyı örneğidir." },
    {
      name: "Datça kıyıları",
      searchName: "Datça",
      note: "Datça çevresi, Ege'de eski akarsu vadilerinin deniz basmasıyla oluşan girintili kıyı örnekleriyle ilişkilendirilir.",
    },
  ],
});

addGroup({
  topic: "coast",
  category: "coast_dalmatian",
  region: "Akdeniz",
  items: [
    { name: "Kaş - Finike arası", searchName: "Kaş Antalya" },
    {
      name: "Kekova çevresi",
      searchName: "Kekova",
      note: "Kekova çevresi, Kaş-Finike arasındaki Dalmaçya kıyı tipinin harita üzerinde ayırt edilen temsil alanıdır.",
    },
    {
      name: "Kalkan - Kaş kıyıları",
      searchName: "Kalkan Antalya",
      note: "Kalkan-Kaş kıyıları, Akdeniz'deki Dalmaçya tipi kıyı örneğinin batı kesimini temsil eder.",
    },
  ],
  note: "Antalya Kaş-Finike arasında görülen Dalmaçya kıyı tipi olarak çalışılır.",
});

addGroup({
  topic: "coast",
  category: "coast_limanli",
  region: "Marmara",
  items: [
    { name: "Büyük Çekmece kıyıları", searchName: "Büyükçekmece" },
    { name: "Küçük Çekmece kıyıları", searchName: "Küçükçekmece" },
    {
      name: "Terkos kıyıları",
      searchName: "Terkos Gölü",
      note: "Terkos çevresi, kıyı setlenmesi ve limanlı kıyı görünümüyle Marmara kıyı tipleri içinde temsil edilir.",
    },
  ],
});

addGroup({
  topic: "coast",
  category: "coast_calankli",
  region: "Akdeniz",
  items: [
    { name: "Mersin - Silifke arası", searchName: "Silifke" },
    {
      name: "Taşucu çevresi",
      searchName: "Taşucu",
      note: "Taşucu çevresi, Mersin-Silifke kıyılarındaki kalanklı kıyı karakterini temsil eder.",
    },
    {
      name: "Narlıkuyu koyları",
      searchName: "Narlıkuyu Mersin",
      note: "Narlıkuyu çevresindeki küçük koylar, kalanklı kıyı tipinin Akdeniz'deki yerel örnekleri olarak çalışılır.",
    },
  ],
  note: "Mersin-Silifke arasında kalanklı kıyı tipi örneği olarak işaretlenir.",
});

const turkeyBounds = {
  minLon: 25,
  maxLon: 46,
  minLat: 35,
  maxLat: 43,
};

function inTurkeyBounds(result) {
  const lon = Number(result.lon);
  const lat = Number(result.lat);

  return lon >= turkeyBounds.minLon && lon <= turkeyBounds.maxLon && lat >= turkeyBounds.minLat && lat <= turkeyBounds.maxLat;
}

function osmUrl(result) {
  return `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`;
}

function manualSourceUrl(correction) {
  return `https://www.openstreetmap.org/?mlat=${correction.lat}&mlon=${correction.lon}#map=9/${correction.lat}/${correction.lon}`;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function osmTypeFromPhoton(osmType) {
  if (osmType === "N") {
    return "node";
  }

  if (osmType === "W") {
    return "way";
  }

  if (osmType === "R") {
    return "relation";
  }

  return "node";
}

function displayNameFromPhoton(properties) {
  return [properties.name, properties.city, properties.county, properties.state, properties.country]
    .filter(Boolean)
    .join(", ");
}

function normalizeSearchTerm(value) {
  return queryBase(value)
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (letter) => {
      const replacements = {
        ç: "c",
        Ç: "c",
        ğ: "g",
        Ğ: "g",
        ı: "i",
        I: "i",
        İ: "i",
        ö: "o",
        Ö: "o",
        ş: "s",
        Ş: "s",
        ü: "u",
        Ü: "u",
      };

      return replacements[letter];
    })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function scoreResult(query, feature) {
  const resultName = normalizeSearchTerm(feature.properties.name ?? "");
  const queryName = normalizeSearchTerm(query);

  let score = 0;

  if (resultName && queryName.includes(resultName)) {
    score += 4;
  }

  if (resultName && resultName.includes(queryName)) {
    score += 4;
  }

  if (feature.properties.countrycode === "TR") {
    score += 2;
  }

  if (["natural", "waterway", "place", "boundary", "leisure"].includes(feature.properties.osm_key)) {
    score += 1;
  }

  if (["shop", "amenity", "tourism"].includes(feature.properties.osm_key)) {
    score -= 5;
  }

  return score;
}

async function geocode(query) {
  if (query in geocodeCache) {
    return geocodeCache[query];
  }

  const params = new URLSearchParams({
    limit: "5",
    q: query,
  });

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
        headers: {
          "User-Agent": "kpss-cografya-atlas/0.1 (local development)",
        },
      });

      if (!response.ok) {
        throw new Error(`Photon ${response.status}: ${query}`);
      }

      const collection = await response.json();
      const candidates = collection.features
        .filter((feature) => {
          const [lon, lat] = feature.geometry.coordinates;
          return feature.properties.countrycode === "TR" && inTurkeyBounds({ lon, lat });
        })
        .map((feature) => ({ feature, score: scoreResult(query, feature) }))
        .sort((left, right) => right.score - left.score);

      const result = candidates[0]?.feature ?? null;

      if (!result) {
        geocodeCache[query] = null;
        await saveCache();
        return null;
      }

      const osm_type = osmTypeFromPhoton(result.properties.osm_type);

      geocodeCache[query] = {
        lon: result.geometry.coordinates[0],
        lat: result.geometry.coordinates[1],
        osm_type,
        osm_id: result.properties.osm_id,
        display_name: displayNameFromPhoton(result.properties),
      };
      await saveCache();
      return geocodeCache[query];
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }

      await sleep(3_000 * attempt);
    }
  }

  return null;
}

async function resolveFeature(feature) {
  const correction = physicalFeatureCoordinateCorrections[feature.id];

  if (correction) {
    return {
      type: "Feature",
      properties: {
        id: feature.id,
        name: feature.name,
        topic: feature.topic,
        topicLabel: feature.topicLabel,
        category: feature.category,
        categoryLabel: feature.categoryLabel,
        region: feature.region,
        location: feature.location,
        kpssNote: feature.kpssNote,
        sourceName: "Elle düzeltilmiş KPSS temsil noktası",
        sourceUrl: manualSourceUrl(correction),
        sourceQuery: "manual:kpss-physical-feature-correction",
        sourceDisplayName: correction.sourceDisplayName,
      },
      geometry: {
        type: "Point",
        coordinates: [correction.lon, correction.lat],
      },
    };
  }

  for (const query of feature.queries) {
    const result = await geocode(query);
    await sleep(250);

    if (result) {
      return {
        type: "Feature",
        properties: {
          id: feature.id,
          name: feature.name,
          topic: feature.topic,
          topicLabel: feature.topicLabel,
          category: feature.category,
          categoryLabel: feature.categoryLabel,
          region: feature.region,
          location: feature.location,
          kpssNote: feature.kpssNote,
          sourceName: `OpenStreetMap ${result.osm_type} ${result.osm_id}`,
          sourceUrl: osmUrl(result),
          sourceQuery: query,
          sourceDisplayName: result.display_name,
        },
        geometry: {
          type: "Point",
          coordinates: [Number(result.lon), Number(result.lat)],
        },
      };
    }
  }

  return null;
}

const resolvedFeatures = [];
const unresolvedFeatures = [];
const seenIds = new Set();

for (const feature of features) {
  if (seenIds.has(feature.id)) {
    throw new Error(`Duplicate feature id: ${feature.id}`);
  }

  seenIds.add(feature.id);
  const resolved = await resolveFeature(feature);

  if (resolved) {
    resolvedFeatures.push(resolved);
    console.log(`✓ ${feature.id}`);
  } else {
    unresolvedFeatures.push({ id: feature.id, name: feature.name, queries: feature.queries });
    console.warn(`! ${feature.id}`);
  }
}

if (unresolvedFeatures.length > 0) {
  console.error(JSON.stringify(unresolvedFeatures, null, 2));
  throw new Error(`${unresolvedFeatures.length} feature(s) could not be geocoded.`);
}

const geoJson = {
  type: "FeatureCollection",
  name: "kpss_turkey_physical_features",
  generatedFrom: "scripts/buildPhysicalFeatures.mjs",
  features: resolvedFeatures,
};

await fs.writeFile(outputPath, `${JSON.stringify(geoJson, null, 2)}\n`);
console.log(`Wrote ${resolvedFeatures.length} features to ${outputPath.pathname}`);
