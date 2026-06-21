import fs from "node:fs/promises";

const outputPath = new URL("../public/geojson/turkey-economic-features.geojson", import.meta.url);

const topicLabels = {
  agriculture: "Tarım",
  livestock: "Hayvancılık",
  mine: "Madenler",
  energy: "Enerji Kaynakları",
  industry: "Sanayi Tesisleri",
  tourism: "Turizm",
  port: "Limanlar",
};

const categoryLabels = {
  agriculture_cereal_legume: "Tahıl / baklagil",
  agriculture_industrial: "Sanayi bitkisi",
  agriculture_climate_selective: "İklim seçiciliği fazla",
  agriculture_special_crop: "Meyve / özel ürün",
  livestock_pasture: "Mera hayvancılığı",
  livestock_stall: "Besi / ahır",
  livestock_small_ruminant: "Küçükbaş",
  livestock_specialized: "Özel hayvancılık",
  livestock_poultry_fishery: "Kümes / balıkçılık",
  mine_metal: "Metal madenleri",
  mine_industrial: "Endüstriyel maden",
  energy_fossil: "Fosil enerji kaynağı",
  energy_hydroelectric: "Hidroelektrik",
  energy_geothermal: "Jeotermal",
  energy_wind: "Rüzgar",
  energy_solar: "Güneş",
  industry_processing: "İşleme / sanayi tesisi",
  industry_refinery_petrochemical: "Rafineri / petrokimya",
  industry_automotive_machinery: "Otomotiv / makine",
  industry_textile: "Tekstil / dokuma",
  industry_food_agro: "Gıda / tarımsal sanayi",
  industry_material: "Kağıt / seramik / cam",
  tourism_coastal: "Kıyı turizmi",
  tourism_cultural: "Kültür / tarih turizmi",
  tourism_winter_thermal: "Kış / termal turizm",
  port_trade: "Büyük dış ticaret limanı",
  port_regional: "Bölgesel / hinterland limanı",
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

function sourceUrl(location) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${location}, Türkiye`)}`;
}

function addGroup({ topic, category, region, note, items }) {
  for (const item of items) {
    const id = item.id ?? `${topic}_${slugify(item.idName ?? `${item.name} ${item.location}`)}`;
    const sourceDisplayName = item.sourceDisplayName ?? item.location;

    features.push({
      type: "Feature",
      properties: {
        id,
        name: item.name,
        topic,
        topicLabel: topicLabels[topic],
        category,
        categoryLabel: categoryLabels[category],
        region: item.region ?? region,
        location: item.location,
        kpssNote:
          item.note ??
          note ??
          `${item.name}, KPSS ekonomi coğrafyasında ${categoryLabels[category].toLowerCase()} örneği olarak izlenir.`,
        sourceName: "KPSS temsil noktası",
        sourceUrl: sourceUrl(sourceDisplayName),
        sourceQuery: `${sourceDisplayName}, Türkiye`,
        sourceDisplayName,
      },
      geometry: {
        type: "Point",
        coordinates: [item.lng, item.lat],
      },
    });
  }
}

addGroup({
  topic: "agriculture",
  category: "agriculture_cereal_legume",
  region: "İç Anadolu / Güneydoğu Anadolu",
  note: "Buğday, karasal iklimin yaygın olduğu İç Anadolu ve Güneydoğu Anadolu'da temel tarım ürünüdür.",
  items: [
    { name: "Buğday", location: "Konya", lat: 37.871, lng: 32.484 },
    { name: "Buğday", location: "Polatlı / Ankara", lat: 39.584, lng: 32.147 },
    { name: "Buğday", location: "Şanlıurfa", lat: 37.159, lng: 38.796 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_industrial",
  region: "Güneydoğu Anadolu / Akdeniz / Ege / Doğu Anadolu",
  note: "Pamuk, yaz kuraklığı ve sulama isteyen sanayi bitkisidir; GAP, Çukurova ve Ege ovaları KPSS'de öne çıkar.",
  items: [
    { name: "Pamuk", location: "Harran / Şanlıurfa", lat: 36.902, lng: 39.015 },
    { name: "Pamuk", location: "Çukurova / Adana", lat: 36.91, lng: 35.33 },
    { name: "Pamuk", location: "Söke / Aydın", lat: 37.75, lng: 27.41 },
    { name: "Pamuk", location: "Iğdır Ovası", lat: 39.92, lng: 44.04 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_industrial",
  region: "İç Anadolu",
  note: "Şeker pancarı çabuk bozulduğu için şeker fabrikalarına yakın alanlarda yoğunlaşır.",
  items: [
    { name: "Şeker pancarı", location: "Konya", lat: 37.871, lng: 32.484 },
    { name: "Şeker pancarı", location: "Eskişehir", lat: 39.78, lng: 30.53 },
    { name: "Şeker pancarı", location: "Yozgat", lat: 39.82, lng: 34.81 },
    { name: "Şeker pancarı", location: "Kayseri", lat: 38.72, lng: 35.48 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_industrial",
  region: "Ege / Karadeniz / Güneydoğu Anadolu",
  note: "Tütün, kalite farkı ve devlet kontrolü nedeniyle KPSS'de bölgesel tarım ürünü olarak sorulur.",
  items: [
    { name: "Tütün", location: "Akhisar / Manisa", lat: 38.924, lng: 27.84 },
    { name: "Tütün", location: "Denizli", lat: 37.776, lng: 29.086 },
    { name: "Tütün", location: "Bafra / Samsun", lat: 41.568, lng: 35.906 },
    { name: "Tütün", location: "Adıyaman", lat: 37.764, lng: 38.278 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_industrial",
  region: "Marmara / İç Anadolu",
  note: "Ayçiçeği üretiminde Ergene Havzası ve Trakya çevresi KPSS'de ana örnektir.",
  items: [
    { name: "Ayçiçeği", location: "Tekirdağ", lat: 40.978, lng: 27.512 },
    { name: "Ayçiçeği", location: "Edirne", lat: 41.677, lng: 26.556 },
    { name: "Ayçiçeği", location: "Konya", lat: 37.871, lng: 32.484 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_climate_selective",
  region: "Karadeniz",
  note: "Fındık, nemli Karadeniz iklimiyle özdeşleşen ve özellikle Ordu-Giresun çevresinde yoğunlaşan üründür.",
  items: [
    { name: "Fındık", location: "Ordu", lat: 40.986, lng: 37.879 },
    { name: "Fındık", location: "Giresun", lat: 40.917, lng: 38.392 },
    { name: "Fındık", location: "Düzce", lat: 40.839, lng: 31.159 },
    { name: "Fındık", location: "Sakarya", lat: 40.756, lng: 30.378 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_climate_selective",
  region: "Doğu Karadeniz",
  note: "Çay, bol yağış ve yıkanmış toprak koşulları nedeniyle Doğu Karadeniz kıyılarında toplanır.",
  items: [
    { name: "Çay", location: "Rize", lat: 41.025, lng: 40.517 },
    { name: "Çay", location: "Trabzon", lat: 41.005, lng: 39.722 },
    { name: "Çay", location: "Artvin", lat: 41.183, lng: 41.819 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_climate_selective",
  region: "Ege / Marmara / Doğu Karadeniz",
  note: "Zeytin, kış ılıklığı isteyen Akdeniz iklimi ürünüdür; Yusufeli mikroklima örneği olarak ayrıca bilinir.",
  items: [
    { name: "Zeytin", location: "Edremit / Balıkesir", lat: 39.596, lng: 27.024 },
    { name: "Zeytin", location: "Aydın", lat: 37.845, lng: 27.839 },
    { name: "Zeytin", location: "Gemlik / Bursa", lat: 40.43, lng: 29.159 },
    { name: "Zeytin", location: "Yusufeli / Artvin", lat: 40.82, lng: 41.537 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_climate_selective",
  region: "Akdeniz / Ege / Doğu Karadeniz",
  note: "Turunçgiller don olayına duyarlıdır; Akdeniz kıyıları ve Rize mikrokliması KPSS'de öne çıkar.",
  items: [
    { name: "Turunçgil", location: "Mersin", lat: 36.812, lng: 34.641 },
    { name: "Turunçgil", location: "Antalya", lat: 36.887, lng: 30.707 },
    { name: "Turunçgil", location: "Çukurova / Adana", lat: 36.91, lng: 35.33 },
    { name: "Turunçgil", location: "Rize", lat: 41.025, lng: 40.517 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_cereal_legume",
  region: "İç Anadolu / Marmara / Karadeniz / Güneydoğu Anadolu",
  note: "Arpa, mısır, pirinç ve baklagiller KPSS'de iklim ve sulama koşullarıyla birlikte sorulan temel tarım ürünleridir.",
  items: [
    { name: "Arpa", location: "Konya", lat: 37.871, lng: 32.484 },
    { name: "Arpa", location: "Ankara", lat: 39.933, lng: 32.859 },
    { name: "Mısır", location: "Çukurova / Adana", lat: 36.91, lng: 35.33 },
    { name: "Mısır", location: "Çarşamba / Samsun", lat: 41.198, lng: 36.721 },
    { name: "Mısır", location: "Sakarya", lat: 40.756, lng: 30.378 },
    { name: "Pirinç", location: "İpsala / Edirne", lat: 40.921, lng: 26.383 },
    { name: "Pirinç", location: "Gönen / Balıkesir", lat: 40.104, lng: 27.654 },
    { name: "Pirinç", location: "Tosya / Kastamonu", lat: 41.015, lng: 34.041 },
    { name: "Mercimek", location: "Diyarbakır", lat: 37.914, lng: 40.23 },
    { name: "Mercimek", location: "Şanlıurfa", lat: 37.159, lng: 38.796 },
    { name: "Mercimek", location: "Mardin", lat: 37.313, lng: 40.735 },
    { name: "Nohut", location: "Konya", lat: 37.871, lng: 32.484 },
    { name: "Nohut", location: "Yozgat", lat: 39.82, lng: 34.81 },
    { name: "Nohut", location: "Kırşehir", lat: 39.146, lng: 34.16 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_industrial",
  region: "Akdeniz / Ege / İç Anadolu",
  note: "Soya, haşhaş ve yer fıstığı; yağ, ilaç ve gıda sanayisiyle bağlantılı KPSS sanayi bitkisi örnekleridir.",
  items: [
    { name: "Soya", location: "Adana", lat: 36.991, lng: 35.331 },
    { name: "Soya", location: "Osmaniye", lat: 37.074, lng: 36.247 },
    { name: "Haşhaş", location: "Afyonkarahisar", lat: 38.756, lng: 30.538 },
    { name: "Haşhaş", location: "Kütahya", lat: 39.419, lng: 29.985 },
    { name: "Haşhaş", location: "Uşak", lat: 38.674, lng: 29.405 },
    { name: "Yer fıstığı", location: "Osmaniye", lat: 37.074, lng: 36.247 },
    { name: "Yer fıstığı", location: "Adana", lat: 36.991, lng: 35.331 },
  ],
});

addGroup({
  topic: "agriculture",
  category: "agriculture_special_crop",
  region: "Ege / Akdeniz / İç Anadolu / Güneydoğu Anadolu",
  note: "Meyve ve özel ürünler, KPSS'de belirli il-ürün eşleştirmeleriyle harita sorularında sık kullanılır.",
  items: [
    { name: "Üzüm", location: "Manisa", lat: 38.619, lng: 27.429 },
    { name: "Üzüm", location: "Denizli", lat: 37.776, lng: 29.086 },
    { name: "Üzüm", location: "İzmir", lat: 38.423, lng: 27.142 },
    { name: "İncir", location: "Aydın", lat: 37.845, lng: 27.839 },
    { name: "Kayısı", location: "Malatya", lat: 38.355, lng: 38.309 },
    { name: "Antep fıstığı", location: "Gaziantep", lat: 37.066, lng: 37.383 },
    { name: "Antep fıstığı", location: "Şanlıurfa", lat: 37.159, lng: 38.796 },
    { name: "Antep fıstığı", location: "Siirt", lat: 37.933, lng: 41.95 },
    { name: "Elma", location: "Isparta", lat: 37.764, lng: 30.556 },
    { name: "Elma", location: "Niğde", lat: 37.966, lng: 34.683 },
    { name: "Elma", location: "Karaman", lat: 37.181, lng: 33.215 },
    { name: "Muz", location: "Anamur / Mersin", lat: 36.075, lng: 32.836 },
    { name: "Muz", location: "Alanya / Antalya", lat: 36.543, lng: 31.999 },
    { name: "Gül", location: "Isparta", lat: 37.764, lng: 30.556 },
    { name: "Patates", location: "Niğde", lat: 37.966, lng: 34.683 },
    { name: "Patates", location: "Nevşehir", lat: 38.624, lng: 34.714 },
  ],
});

addGroup({
  topic: "livestock",
  category: "livestock_pasture",
  region: "Doğu Anadolu",
  note: "Erzurum-Kars-Ardahan çevresi yaz yağışlı çayırlarıyla büyükbaş mera hayvancılığının klasik KPSS alanıdır.",
  items: [
    { name: "Büyükbaş mera", location: "Erzurum", lat: 39.906, lng: 41.273 },
    { name: "Büyükbaş mera", location: "Kars", lat: 40.602, lng: 43.095 },
    { name: "Büyükbaş mera", location: "Ardahan", lat: 41.11, lng: 42.702 },
    { name: "Büyükbaş mera", location: "Ağrı", lat: 39.719, lng: 43.051 },
    { name: "Büyükbaş mera", location: "Muş", lat: 38.745, lng: 41.491 },
    { name: "Büyükbaş mera", location: "Bingöl", lat: 38.885, lng: 40.498 },
  ],
});

addGroup({
  topic: "livestock",
  category: "livestock_stall",
  region: "Marmara / Ege / İç Anadolu",
  note: "Besi ve ahır hayvancılığı pazar, yem ve sanayi olanaklarına yakın gelişir.",
  items: [
    { name: "Büyükbaş besi", location: "Marmara / İstanbul çevresi", lat: 41.01, lng: 28.96 },
    { name: "Büyükbaş besi", location: "Ege / İzmir çevresi", lat: 38.42, lng: 27.14 },
    { name: "Büyükbaş besi", location: "Konya", lat: 37.871, lng: 32.484 },
    {
      name: "Büyükbaş besi",
      location: "Bursa",
      lat: 40.183,
      lng: 29.067,
      note: "Bursa, pazara yakınlık ve yem sanayisi bağlantısıyla Marmara'nın besi/süt sığırcılığı merkezlerinden biridir.",
    },
    {
      name: "Büyükbaş besi",
      location: "Çukurova / Adana",
      lat: 37.0,
      lng: 35.32,
      note: "Çukurova, pamuk çiğidi ve yem bitkisi üretimine bağlı besi hayvancılığıyla bilinir.",
    },
    {
      name: "Büyükbaş besi",
      location: "Balıkesir",
      lat: 39.649,
      lng: 27.882,
      note: "Balıkesir, yem sanayisi ve Marmara pazarına yakınlığıyla besi ve süt hayvancılığı örneğidir.",
    },
    {
      name: "Büyükbaş besi",
      location: "Afyonkarahisar",
      lat: 38.756,
      lng: 30.538,
      note: "Afyonkarahisar, İç Batı Anadolu'da yem bitkileri ve hayvansal ürün sanayisiyle ilişkilendirilen besi merkezidir.",
    },
    {
      name: "Büyükbaş besi",
      location: "Aksaray",
      lat: 38.368,
      lng: 34.037,
      note: "Aksaray, İç Anadolu'da organize hayvancılık ve yem bağlantısıyla besi hayvancılığı örneği olarak çalışılır.",
    },
  ],
});

addGroup({
  topic: "livestock",
  category: "livestock_small_ruminant",
  region: "İç Anadolu / Güneydoğu Anadolu",
  note: "Koyun yetiştiriciliği bozkır bitki örtüsünün yaygın olduğu İç Anadolu ve Güneydoğu Anadolu'da öne çıkar.",
  items: [
    { name: "Koyun", location: "Konya", lat: 37.871, lng: 32.484 },
    { name: "Koyun", location: "Polatlı / Ankara", lat: 39.584, lng: 32.147 },
    { name: "Koyun", location: "Şanlıurfa", lat: 37.159, lng: 38.796 },
    { name: "Koyun", location: "Diyarbakır", lat: 37.914, lng: 40.23 },
    { name: "Koyun", location: "Yozgat", lat: 39.82, lng: 34.81 },
    { name: "Koyun", location: "Van", lat: 38.501, lng: 43.373 },
    { name: "Koyun", location: "Mardin", lat: 37.312, lng: 40.739 },
  ],
});

addGroup({
  topic: "livestock",
  category: "livestock_small_ruminant",
  region: "Akdeniz",
  note: "Kıl keçisi, engebeli ve makilik alanlarda; Teke ve Taşeli platoları çevresinde yaygındır.",
  items: [
    { name: "Kıl keçisi", location: "Teke Platosu", lat: 36.92, lng: 29.92 },
    { name: "Kıl keçisi", location: "Taşeli Platosu", lat: 36.76, lng: 32.72 },
  ],
});

addGroup({
  topic: "livestock",
  category: "livestock_specialized",
  region: "İç Anadolu",
  note: "Tiftik keçisi Ankara ve çevresiyle özdeşleşen özel hayvancılık örneğidir.",
  items: [{ name: "Tiftik keçisi", location: "Ankara", lat: 39.933, lng: 32.859 }],
});

addGroup({
  topic: "livestock",
  category: "livestock_specialized",
  region: "Ege / Karadeniz / Doğu Anadolu",
  note: "Arıcılık, bitki çeşitliliği ve yaylacılık koşullarıyla Muğla, Rize-Anzer, Ordu, Hakkari ve Kars çevresinde sorulur.",
  items: [
    { name: "Arıcılık", location: "Muğla", lat: 37.215, lng: 28.363 },
    { name: "Arıcılık", location: "Anzer / Rize", lat: 40.642, lng: 40.52 },
    { name: "Arıcılık", location: "Ordu", lat: 40.986, lng: 37.879 },
    { name: "Arıcılık", location: "Hakkari", lat: 37.574, lng: 43.74 },
    { name: "Arıcılık", location: "Kars", lat: 40.602, lng: 43.095 },
  ],
});

addGroup({
  topic: "livestock",
  category: "livestock_specialized",
  region: "Güneydoğu Anadolu / Marmara / Akdeniz",
  note: "İpekböcekçiliği dut yetiştiriciliğiyle ilişkilidir; Diyarbakır, Bursa ve Antalya KPSS örnekleridir.",
  items: [
    { name: "İpekböcekçiliği", location: "Diyarbakır", lat: 37.914, lng: 40.23 },
    { name: "İpekböcekçiliği", location: "Bursa", lat: 40.183, lng: 29.067 },
    { name: "İpekböcekçiliği", location: "Antalya", lat: 36.887, lng: 30.707 },
  ],
});

addGroup({
  topic: "livestock",
  category: "livestock_poultry_fishery",
  region: "Marmara / Ege / Karadeniz",
  note: "Kümes hayvancılığı büyük tüketim pazarlarına ve yem-sanayi bağlantısına yakın alanlarda gelişir.",
  items: [
    { name: "Kümes hayvancılığı", location: "Bolu", lat: 40.735, lng: 31.607 },
    { name: "Kümes hayvancılığı", location: "Balıkesir", lat: 39.649, lng: 27.882 },
    { name: "Kümes hayvancılığı", location: "Manisa", lat: 38.619, lng: 27.429 },
    { name: "Kümes hayvancılığı", location: "Sakarya", lat: 40.756, lng: 30.378 },
  ],
});

addGroup({
  topic: "livestock",
  category: "livestock_poultry_fishery",
  region: "Karadeniz / Ege",
  note: "Balıkçılıkta Karadeniz kıyıları, kültür balıkçılığında ise Ege kıyıları KPSS harita eşleştirmelerinde kullanılır.",
  items: [
    { name: "Balıkçılık", location: "Trabzon", lat: 41.005, lng: 39.722 },
    { name: "Balıkçılık", location: "Sinop", lat: 42.027, lng: 35.151 },
    { name: "Balıkçılık", location: "Samsun", lat: 41.286, lng: 36.33 },
    { name: "Kültür balıkçılığı", location: "Muğla", lat: 37.215, lng: 28.363 },
    { name: "Kültür balıkçılığı", location: "İzmir", lat: 38.423, lng: 27.142 },
  ],
});

addGroup({
  topic: "mine",
  category: "mine_metal",
  region: "İç Anadolu / Doğu Anadolu",
  note: "Demir çıkarımında Divriği, Kangal, Hekimhan ve Hasançelebi KPSS'de sık eşleştirilen alanlardır.",
  items: [
    { name: "Demir", location: "Divriği / Sivas", lat: 39.371, lng: 38.114 },
    { name: "Demir", location: "Kangal / Sivas", lat: 39.233, lng: 37.391 },
    { name: "Demir", location: "Hekimhan / Malatya", lat: 38.817, lng: 37.928 },
    { name: "Demir", location: "Hasançelebi / Malatya", lat: 38.951, lng: 37.893 },
  ],
});

addGroup({
  topic: "mine",
  category: "mine_metal",
  region: "Karadeniz / Doğu Anadolu",
  note: "Bakır çıkarımında Küre, Murgul, Ergani, Maden ve Çayeli temel KPSS noktalarıdır.",
  items: [
    { name: "Bakır", location: "Küre / Kastamonu", lat: 41.805, lng: 33.711 },
    { name: "Bakır", location: "Murgul / Artvin", lat: 41.279, lng: 41.557 },
    { name: "Bakır", location: "Ergani / Diyarbakır", lat: 38.269, lng: 39.754 },
    { name: "Bakır", location: "Maden / Elazığ", lat: 38.391, lng: 39.673 },
    { name: "Bakır", location: "Çayeli / Rize", lat: 41.091, lng: 40.731 },
  ],
});

addGroup({
  topic: "mine",
  category: "mine_industrial",
  region: "Marmara / Ege / İç Anadolu",
  note: "Bor yatakları Susurluk, Bigadiç, Mustafakemalpaşa, Emet ve Kırka çevresinde yoğunlaşır.",
  items: [
    { name: "Bor", location: "Susurluk / Balıkesir", lat: 39.913, lng: 28.158 },
    { name: "Bor", location: "Bigadiç / Balıkesir", lat: 39.392, lng: 28.132 },
    { name: "Bor", location: "Kestelek / Mustafakemalpaşa / Bursa", lat: 40.039, lng: 28.411 },
    { name: "Bor", location: "Emet / Kütahya", lat: 39.343, lng: 29.258 },
    { name: "Bor", location: "Kırka / Eskişehir", lat: 39.279, lng: 30.527 },
  ],
});

addGroup({
  topic: "mine",
  category: "mine_metal",
  region: "Doğu Anadolu / Ege / Akdeniz",
  note: "Krom çıkarımında Guleman, Fethiye, Köyceğiz, Buldan ve Aladağ örnekleri öne çıkar.",
  items: [
    { name: "Krom", location: "Guleman / Elazığ", lat: 38.533, lng: 39.932 },
    { name: "Krom", location: "Fethiye / Muğla", lat: 36.621, lng: 29.116 },
    { name: "Krom", location: "Köyceğiz / Muğla", lat: 36.967, lng: 28.686 },
    { name: "Krom", location: "Buldan / Denizli", lat: 38.045, lng: 28.831 },
    { name: "Krom", location: "Aladağ / Adana", lat: 37.545, lng: 35.397 },
  ],
});

addGroup({
  topic: "mine",
  category: "mine_metal",
  region: "Akdeniz / İç Anadolu",
  note: "Boksit, alüminyum sanayisiyle ilişkili olarak Seydişehir ve Akseki çevresinde bilinir.",
  items: [
    { name: "Boksit", location: "Seydişehir / Konya", lat: 37.419, lng: 31.845 },
    { name: "Boksit", location: "Akseki / Antalya", lat: 37.049, lng: 31.79 },
  ],
});

addGroup({
  topic: "mine",
  category: "mine_industrial",
  region: "İç Anadolu / Ege / Akdeniz / Güneydoğu Anadolu",
  note: "Endüstriyel madenler KPSS'de belirli merkezlerle eşleştirilir; tuz, fosfat, kükürt, mermer ve lületaşı temel örneklerdir.",
  items: [
    { name: "Fosfat", location: "Mazıdağı / Mardin", lat: 37.478, lng: 40.484 },
    { name: "Kükürt", location: "Keçiborlu / Isparta", lat: 37.942, lng: 30.303 },
    { name: "Tuz", location: "Tuz Gölü / Aksaray", lat: 38.787, lng: 33.374 },
    { name: "Tuz", location: "Çamaltı / İzmir", lat: 38.517, lng: 26.89 },
    { name: "Kaya tuzu", location: "Çankırı", lat: 40.601, lng: 33.613 },
    { name: "Mermer", location: "Afyonkarahisar", lat: 38.756, lng: 30.538 },
    { name: "Mermer", location: "Bilecik", lat: 40.143, lng: 29.979 },
    { name: "Mermer", location: "Marmara Adası / Balıkesir", lat: 40.587, lng: 27.555 },
    { name: "Lületaşı", location: "Eskişehir", lat: 39.766, lng: 30.526 },
  ],
});

addGroup({
  topic: "mine",
  category: "mine_metal",
  region: "Marmara / Doğu Anadolu / Ege / İç Anadolu",
  note: "Kurşun-çinko, manganez, cıva ve altın; KPSS maden haritalarında belirli çıkarım merkezleriyle eşleştirilir.",
  items: [
    { name: "Kurşun-çinko", location: "Balya / Balıkesir", lat: 39.748, lng: 27.578 },
    { name: "Kurşun-çinko", location: "Keban / Elazığ", lat: 38.793, lng: 38.735 },
    { name: "Manganez", location: "Tavas / Denizli", lat: 37.574, lng: 29.071 },
    { name: "Manganez", location: "Borçka / Artvin", lat: 41.357, lng: 41.676 },
    { name: "Cıva", location: "Ödemiş / İzmir", lat: 38.228, lng: 27.971 },
    { name: "Cıva", location: "Sarayönü / Konya", lat: 38.264, lng: 32.404 },
    { name: "Altın", location: "Ovacık / Bergama / İzmir", lat: 39.179, lng: 27.335 },
    { name: "Altın", location: "İliç / Erzincan", lat: 39.456, lng: 38.564 },
    {
      name: "Volfram",
      location: "Uludağ / Bursa",
      lat: 40.111,
      lng: 29.232,
      note: "Uludağ, Türkiye'nin volfram (tungsten) yatağı bakımından KPSS'de en bilinen örneğidir.",
    },
    {
      name: "Antimon",
      location: "Turhal / Tokat",
      lat: 40.383,
      lng: 36.083,
      note: "Turhal, antimon çıkarımıyla Karadeniz iç kesiminin KPSS maden örneklerindendir.",
    },
  ],
});

addGroup({
  topic: "mine",
  category: "mine_industrial",
  region: "Doğu Anadolu / Ege",
  note: "Oltu taşı ve zımpara taşı, KPSS'de yerel endüstriyel maden örneği olarak eşleştirilebilir.",
  items: [
    { name: "Oltu taşı", location: "Oltu / Erzurum", lat: 40.55, lng: 41.995 },
    { name: "Zımpara taşı", location: "Milas / Muğla", lat: 37.312, lng: 27.78 },
  ],
});

addGroup({
  topic: "energy",
  category: "energy_fossil",
  region: "Karadeniz / Ege / İç Anadolu / Güneydoğu Anadolu",
  note: "Fosil enerji kaynaklarında taşkömürü, linyit, petrol ve doğal gazın klasik üretim alanları KPSS'de sık sorulur.",
  items: [
    { name: "Taşkömürü", location: "Zonguldak", lat: 41.456, lng: 31.798 },
    { name: "Taşkömürü", location: "Amasra / Bartın", lat: 41.746, lng: 32.386 },
    { name: "Linyit", location: "Soma / Manisa", lat: 39.185, lng: 27.609 },
    { name: "Linyit", location: "Tunçbilek / Kütahya", lat: 39.676, lng: 29.437 },
    { name: "Linyit", location: "Seyitömer / Kütahya", lat: 39.572, lng: 29.892 },
    { name: "Linyit", location: "Afşin-Elbistan / Kahramanmaraş", lat: 38.355, lng: 36.937 },
    { name: "Linyit", location: "Yatağan / Muğla", lat: 37.341, lng: 28.141 },
    { name: "Petrol", location: "Batman", lat: 37.889, lng: 41.129 },
    { name: "Petrol", location: "Adıyaman", lat: 37.764, lng: 38.278 },
    { name: "Petrol", location: "Diyarbakır", lat: 37.914, lng: 40.23 },
    { name: "Petrol", location: "Siirt", lat: 37.933, lng: 41.95 },
    { name: "Doğal gaz", location: "Hamitabat / Kırklareli", lat: 41.621, lng: 27.516 },
    { name: "Doğal gaz", location: "Çamurlu / Mardin", lat: 37.251, lng: 40.73 },
    { name: "Doğal gaz", location: "Filyos / Zonguldak", lat: 41.559, lng: 32.04 },
  ],
});

addGroup({
  topic: "energy",
  category: "energy_hydroelectric",
  region: "Doğu Anadolu / Güneydoğu Anadolu / Karadeniz / İç Anadolu / Akdeniz",
  note: "Hidroelektrik enerji, akarsu eğimi ve debisiyle ilişkilidir; Fırat, Dicle, Çoruh, Kızılırmak ve Manavgat üzerindeki büyük HES'ler KPSS'de öne çıkar.",
  items: [
    { name: "Atatürk HES", location: "Bozova / Şanlıurfa", lat: 37.481, lng: 38.318 },
    { name: "Keban HES", location: "Keban / Elazığ", lat: 38.806, lng: 38.755 },
    { name: "Karakaya HES", location: "Çüngüş / Diyarbakır", lat: 38.228, lng: 39.143 },
    { name: "Deriner HES", location: "Artvin / Çoruh", lat: 41.181, lng: 41.815 },
    { name: "Altınkaya HES", location: "Bafra / Samsun", lat: 41.361, lng: 35.731 },
    { name: "Hirfanlı HES", location: "Kaman / Kırşehir", lat: 39.273, lng: 33.518 },
    { name: "Oymapınar HES", location: "Manavgat / Antalya", lat: 36.906, lng: 31.536 },
    {
      name: "Yusufeli HES",
      location: "Yusufeli / Artvin",
      lat: 40.82,
      lng: 41.55,
      note: "Yusufeli HES, Çoruh Havzası'nın yüksek eğim ve dar vadi koşullarıyla ilişkilendirilen büyük hidroelektrik örneğidir.",
    },
    {
      name: "Ilısu HES",
      location: "Dargeçit / Mardin",
      lat: 37.53,
      lng: 41.86,
      note: "Ilısu HES, Dicle üzerinde Güneydoğu Anadolu'nun büyük hidroelektrik yatırımlarından biridir.",
    },
    {
      name: "Berke HES",
      location: "Düziçi / Osmaniye",
      lat: 37.02,
      lng: 36.33,
      note: "Berke HES, Ceyhan Havzası üzerinde Akdeniz Bölgesi'nin hidroelektrik örnekleri arasında çalışılır.",
    },
  ],
});

addGroup({
  topic: "energy",
  category: "energy_geothermal",
  region: "Ege / Marmara",
  note: "Jeotermal enerji Batı Anadolu grabenleriyle ilişkilidir; Denizli, Aydın ve Manisa çevresi KPSS'de temel örneklerdir.",
  items: [
    { name: "Jeotermal enerji", location: "Kızıldere / Sarayköy / Denizli", lat: 37.951, lng: 28.872 },
    { name: "Jeotermal enerji", location: "Germencik / Aydın", lat: 37.87, lng: 27.603 },
    { name: "Jeotermal enerji", location: "Alaşehir / Manisa", lat: 38.35, lng: 28.517 },
    { name: "Jeotermal enerji", location: "Tuzla / Çanakkale", lat: 39.555, lng: 26.2 },
    { name: "Jeotermal enerji", location: "Simav / Kütahya", lat: 39.092, lng: 28.984 },
    { name: "Jeotermal enerji", location: "Afyonkarahisar", lat: 38.756, lng: 30.538 },
    {
      name: "Jeotermal enerji",
      location: "Balçova / İzmir",
      lat: 38.39,
      lng: 27.05,
      note: "Balçova, Batı Anadolu fay hatlarıyla ilişkili jeotermal potansiyelin şehirsel kullanım örneklerindendir.",
    },
    {
      name: "Jeotermal enerji",
      location: "Dikili / İzmir",
      lat: 39.071,
      lng: 26.889,
      note: "Dikili, Ege graben sistemi çevresindeki jeotermal alanlardan biri olarak temsil edilir.",
    },
  ],
});

addGroup({
  topic: "energy",
  category: "energy_wind",
  region: "Ege / Marmara / Akdeniz",
  note: "Rüzgar enerjisi Ege ve Marmara kıyıları ile geçit rüzgarlarının güçlü olduğu alanlarda yoğunlaşır.",
  items: [
    { name: "Rüzgar enerjisi", location: "Alaçatı / Çeşme / İzmir", lat: 38.282, lng: 26.376 },
    { name: "Rüzgar enerjisi", location: "Bandırma / Balıkesir", lat: 40.352, lng: 27.976 },
    { name: "Rüzgar enerjisi", location: "Bozcaada / Çanakkale", lat: 39.835, lng: 26.07 },
    { name: "Rüzgar enerjisi", location: "Belen / Hatay", lat: 36.489, lng: 36.194 },
    { name: "Rüzgar enerjisi", location: "Karaburun / İzmir", lat: 38.642, lng: 26.512 },
    { name: "Rüzgar enerjisi", location: "Gönen / Balıkesir", lat: 40.106, lng: 27.654 },
    {
      name: "Rüzgar enerjisi",
      location: "Bahçe / Osmaniye",
      lat: 37.199,
      lng: 36.31,
      note: "Nurdağı Geçidi çevresindeki geçit rüzgarları, dağlar arası boğazlarda hızlanan rüzgardan yararlanan enerji yatırımlarına örnektir.",
    },
  ],
});

addGroup({
  topic: "energy",
  category: "energy_solar",
  region: "İç Anadolu / Güneydoğu Anadolu / Akdeniz",
  note: "Güneş enerjisi yıllık güneşlenme süresi yüksek olan İç Anadolu, Güneydoğu Anadolu ve Akdeniz iç kesimleriyle ilişkilidir.",
  items: [
    { name: "Güneş enerjisi", location: "Karapınar / Konya", lat: 37.715, lng: 33.552 },
    { name: "Güneş enerjisi", location: "Bor / Niğde", lat: 37.89, lng: 34.558 },
    { name: "Güneş enerjisi", location: "Ceylanpınar / Şanlıurfa", lat: 36.847, lng: 40.05 },
    { name: "Güneş enerjisi", location: "Aksaray", lat: 38.372, lng: 34.038 },
    { name: "Güneş enerjisi", location: "Mardin", lat: 37.312, lng: 40.739 },
    { name: "Güneş enerjisi", location: "Şırnak", lat: 37.518, lng: 42.454 },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_processing",
  region: "Karadeniz / Akdeniz / İç Anadolu",
  note: "Demir-çelik tesisleri taş kömürü, liman, ulaşım ve hammadde bağlantılarıyla KPSS'de sorulur.",
  items: [
    { name: "Demir-çelik", location: "Karabük", lat: 41.195, lng: 32.622 },
    { name: "Demir-çelik", location: "Ereğli / Zonguldak", lat: 41.279, lng: 31.421 },
    { name: "Demir-çelik", location: "İskenderun / Hatay", lat: 36.587, lng: 36.173 },
    { name: "Demir-çelik", location: "Sivas", lat: 39.75, lng: 37.015 },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_processing",
  region: "Karadeniz / Doğu Anadolu / Güneydoğu Anadolu",
  note: "Bakır işleme tesisleri çıkarım alanları ve liman bağlantısıyla Samsun, Artvin ve Diyarbakır çevresinde gösterilir.",
  items: [
    { name: "Bakır işleme", location: "Samsun", lat: 41.286, lng: 36.33 },
    { name: "Bakır işleme", location: "Murgul / Artvin", lat: 41.279, lng: 41.557 },
    { name: "Bakır işleme", location: "Ergani / Diyarbakır", lat: 38.269, lng: 39.754 },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_processing",
  region: "Marmara / İç Anadolu",
  note: "Bor işleme tesislerinde Bandırma ve Kırka, bor yataklarıyla birlikte KPSS eşleştirmelerinde kullanılır.",
  items: [
    { name: "Bor işleme", location: "Bandırma / Balıkesir", lat: 40.352, lng: 27.976 },
    { name: "Bor işleme", location: "Kırka / Eskişehir", lat: 39.279, lng: 30.527 },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_processing",
  region: "Akdeniz / Doğu Anadolu",
  note: "Krom işleme ve ferrokrom tesislerinde Antalya ve Elazığ bağlantısı KPSS'de öne çıkar.",
  items: [
    { name: "Krom işleme", location: "Antalya", lat: 36.887, lng: 30.707 },
    { name: "Krom işleme", location: "Elazığ", lat: 38.674, lng: 39.222 },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_processing",
  region: "İç Anadolu",
  note: "Alüminyum tesisi, boksit çıkarımıyla ilişkili olarak Seydişehir çevresinde gösterilir.",
  items: [{ name: "Alüminyum", location: "Seydişehir / Konya", lat: 37.419, lng: 31.845 }],
});

addGroup({
  topic: "industry",
  category: "industry_refinery_petrochemical",
  region: "Marmara / Ege / İç Anadolu / Güneydoğu Anadolu",
  note: "Rafineriler ve petrokimya tesisleri ham petrol, liman ve pazar bağlantıları nedeniyle KPSS sanayi haritalarında klasik merkezlerdir.",
  items: [
    { name: "Petrol rafinerisi", location: "İzmit / Kocaeli", lat: 40.766, lng: 29.917 },
    { name: "Petrol rafinerisi", location: "Aliağa / İzmir", lat: 38.8, lng: 26.972 },
    { name: "Petrol rafinerisi", location: "Kırıkkale", lat: 39.846, lng: 33.515 },
    { name: "Petrol rafinerisi", location: "Batman", lat: 37.889, lng: 41.129 },
    { name: "Petrokimya", location: "Aliağa / İzmir", lat: 38.8, lng: 26.972 },
    {
      name: "Petrokimya",
      location: "Yarımca / Kocaeli",
      lat: 40.75,
      lng: 29.74,
      note: "Yarımca, Marmara sanayi kuşağında rafineri-petrokimya ve pazar bağlantısıyla verilen klasik sanayi örneğidir.",
    },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_automotive_machinery",
  region: "Marmara / İç Anadolu",
  note: "Otomotiv ve makine sanayisinde Bursa, Kocaeli ve Sakarya çekirdek; Eskişehir ve Aksaray tamamlayıcı KPSS merkezleridir.",
  items: [
    { name: "Otomotiv", location: "Bursa", lat: 40.183, lng: 29.067 },
    { name: "Otomotiv", location: "Gölcük / Kocaeli", lat: 40.717, lng: 29.82 },
    { name: "Otomotiv", location: "Adapazarı / Sakarya", lat: 40.773, lng: 30.402 },
    { name: "Otomotiv", location: "İnönü / Eskişehir", lat: 39.815, lng: 30.145 },
    { name: "Otomotiv", location: "Aksaray", lat: 38.368, lng: 34.037 },
    {
      name: "Makine sanayi",
      location: "Ankara",
      lat: 39.933,
      lng: 32.859,
      note: "Ankara, savunma ve makine sanayisiyle İç Anadolu'nun ileri imalat merkezlerinden biridir.",
    },
    {
      name: "Makine sanayi",
      location: "Konya",
      lat: 37.871,
      lng: 32.484,
      note: "Konya, tarım makineleri ve makine imalatıyla İç Anadolu sanayi merkezleri arasında çalışılır.",
    },
    {
      name: "Raylı sistem sanayi",
      location: "Eskişehir",
      lat: 39.766,
      lng: 30.526,
      note: "Eskişehir, lokomotif/raylı sistem ve makine sanayisiyle KPSS sanayi merkezleri içinde yer alır.",
    },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_textile",
  region: "Marmara / Ege / Güneydoğu Anadolu / İç Anadolu / Akdeniz",
  note: "Tekstil ve dokuma sanayisi pazar, liman, pamuk ve işgücü bağlantısıyla İstanbul, Bursa, Denizli, Gaziantep, Kayseri ve Adana'da öne çıkar.",
  items: [
    { name: "Tekstil", location: "İstanbul", lat: 41.008, lng: 28.978 },
    { name: "Tekstil", location: "Bursa", lat: 40.183, lng: 29.067 },
    { name: "Tekstil", location: "Denizli", lat: 37.776, lng: 29.086 },
    { name: "Tekstil", location: "Gaziantep", lat: 37.066, lng: 37.383 },
    { name: "Tekstil", location: "Kayseri", lat: 38.722, lng: 35.487 },
    { name: "Tekstil", location: "Adana", lat: 36.991, lng: 35.331 },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_food_agro",
  region: "İç Anadolu / Doğu Anadolu / Karadeniz / Ege",
  note: "Tarımsal sanayi tesisleri, ürüne yakınlık ve bozulabilirlik nedeniyle üretim alanlarıyla birlikte öğrenilir.",
  items: [
    { name: "Şeker fabrikası", location: "Konya", lat: 37.871, lng: 32.484 },
    { name: "Şeker fabrikası", location: "Eskişehir", lat: 39.78, lng: 30.53 },
    { name: "Şeker fabrikası", location: "Kayseri", lat: 38.722, lng: 35.487 },
    { name: "Şeker fabrikası", location: "Erzurum", lat: 39.906, lng: 41.273 },
    { name: "Çay işleme", location: "Rize", lat: 41.025, lng: 40.517 },
    { name: "Fındık işleme", location: "Ordu", lat: 40.986, lng: 37.879 },
    { name: "Fındık işleme", location: "Giresun", lat: 40.917, lng: 38.392 },
    { name: "Zeytinyağı", location: "Edremit / Balıkesir", lat: 39.596, lng: 27.024 },
    { name: "Zeytinyağı", location: "Aydın", lat: 37.845, lng: 27.839 },
    {
      name: "Kayısı işleme",
      location: "Malatya",
      lat: 38.355,
      lng: 38.309,
      note: "Malatya, kuru kayısı üretimi ve işlemesinde Türkiye'nin KPSS'de en bilinen merkezidir.",
    },
    {
      name: "Fıstık işleme",
      location: "Gaziantep",
      lat: 37.066,
      lng: 37.383,
      note: "Gaziantep, Antep fıstığı üretimi ve işleme sanayisiyle Güneydoğu Anadolu'nun KPSS örneklerindendir.",
    },
  ],
});

addGroup({
  topic: "industry",
  category: "industry_material",
  region: "Marmara / Ege / Karadeniz / Akdeniz",
  note: "Kağıt, seramik ve cam sanayisi hammadde, enerji, su, ulaşım ve pazar koşullarıyla birlikte sorulur.",
  items: [
    { name: "Kağıt sanayi", location: "İzmit / Kocaeli", lat: 40.766, lng: 29.917 },
    { name: "Kağıt sanayi", location: "Dalaman / Muğla", lat: 36.766, lng: 28.802 },
    { name: "Kağıt sanayi", location: "Çaycuma / Zonguldak", lat: 41.426, lng: 32.075 },
    { name: "Seramik sanayi", location: "Kütahya", lat: 39.419, lng: 29.985 },
    { name: "Seramik sanayi", location: "Bilecik", lat: 40.143, lng: 29.979 },
    {
      name: "Seramik sanayi",
      location: "Uşak",
      lat: 38.674,
      lng: 29.405,
      note: "Uşak, Ege iç kesiminde seramik ve yerel hammadde bağlantısıyla verilen sanayi örneklerindendir.",
    },
    { name: "Cam sanayi", location: "Paşabahçe / İstanbul", lat: 41.117, lng: 29.093 },
    { name: "Cam sanayi", location: "Mersin", lat: 36.812, lng: 34.641 },
    {
      name: "Cam sanayi",
      location: "Lüleburgaz / Kırklareli",
      lat: 41.404,
      lng: 27.359,
      note: "Lüleburgaz çevresi, Trakya sanayi kuşağında cam sanayisiyle ilişkilendirilen merkezlerdendir.",
    },
  ],
});

addGroup({
  topic: "tourism",
  category: "tourism_coastal",
  region: "Akdeniz / Ege",
  note: "Kıyı turizmi yaz kuraklığı, uzun güneşlenme süresi, koy-körfez yapısı ve ulaşım bağlantılarıyla ilişkilidir.",
  items: [
    { name: "Kıyı turizmi", location: "Antalya", lat: 36.887, lng: 30.707 },
    { name: "Kıyı turizmi", location: "Bodrum / Muğla", lat: 37.034, lng: 27.43 },
    { name: "Kıyı turizmi", location: "Marmaris / Muğla", lat: 36.855, lng: 28.274 },
    { name: "Kıyı turizmi", location: "Kuşadası / Aydın", lat: 37.858, lng: 27.259 },
    { name: "Kıyı turizmi", location: "Alanya / Antalya", lat: 36.544, lng: 31.998 },
    { name: "Kıyı turizmi", location: "Çeşme / İzmir", lat: 38.323, lng: 26.306 },
    { name: "Kıyı turizmi", location: "Datça / Muğla", lat: 36.726, lng: 27.684 },
    {
      name: "Kıyı turizmi",
      location: "Ölüdeniz / Fethiye / Muğla",
      lat: 36.548,
      lng: 29.119,
      note: "Ölüdeniz, Akdeniz kıyı turizminin koy-lagün tipi yer şekliyle ilişkilendirilen klasik örneklerinden biridir.",
    },
  ],
});

addGroup({
  topic: "tourism",
  category: "tourism_cultural",
  region: "Marmara / İç Anadolu / Ege / Güneydoğu Anadolu / Doğu Anadolu / Karadeniz",
  note: "Kültür ve tarih turizmi KPSS'de belirli merkezlerin bölge ve konum eşleştirmesiyle sorulur.",
  items: [
    { name: "Kültür turizmi", location: "Tarihi Yarımada / İstanbul", lat: 41.008, lng: 28.978 },
    { name: "Kültür turizmi", location: "Göreme / Kapadokya / Nevşehir", lat: 38.643, lng: 34.829 },
    { name: "Kültür turizmi", location: "Efes / Selçuk / İzmir", lat: 37.939, lng: 27.341 },
    { name: "Kültür turizmi", location: "Pamukkale / Denizli", lat: 37.913, lng: 29.118 },
    { name: "Kültür turizmi", location: "Safranbolu / Karabük", lat: 41.25, lng: 32.694 },
    { name: "Kültür turizmi", location: "Nemrut Dağı / Adıyaman", lat: 37.98, lng: 38.741 },
    { name: "Kültür turizmi", location: "Ani / Kars", lat: 40.507, lng: 43.573 },
    {
      name: "Kültür turizmi",
      location: "Truva Antik Kenti / Çanakkale",
      lat: 39.957,
      lng: 26.239,
      note: "Truva Antik Kenti, Çanakkale'nin tarih turizmindeki en bilinen UNESCO Dünya Mirası örneğidir.",
    },
    {
      name: "Kültür turizmi",
      location: "Sümela Manastırı / Maçka / Trabzon",
      lat: 40.696,
      lng: 39.661,
      note: "Sümela Manastırı, Doğu Karadeniz'in dağlık-kayalık yamaçlarına kurulu kültür turizmi örneğidir.",
    },
    {
      name: "Kültür turizmi",
      location: "Hattuşaş / Boğazkale / Çorum",
      lat: 40.014,
      lng: 34.615,
      note: "Hattuşaş, İç Anadolu'da Hitit medeniyetine ait UNESCO Dünya Mirası kültür turizmi merkezidir.",
    },
    {
      name: "Kültür turizmi",
      location: "Mardin",
      lat: 37.312,
      lng: 40.739,
      note: "Mardin'in taş mimarisiyle tarihi şehir dokusu, Güneydoğu Anadolu'nun kültür turizmi örneklerinden biridir.",
    },
  ],
});

addGroup({
  topic: "tourism",
  category: "tourism_winter_thermal",
  region: "Marmara / Doğu Anadolu / İç Anadolu / Karadeniz / Ege",
  note: "Kış ve termal turizm; yükselti, kar örtüsü, fay hatları ve sıcak su kaynaklarıyla ilişkilidir.",
  items: [
    { name: "Kış turizmi", location: "Uludağ / Bursa", lat: 40.071, lng: 29.222 },
    { name: "Kış turizmi", location: "Palandöken / Erzurum", lat: 39.861, lng: 41.278 },
    { name: "Kış turizmi", location: "Erciyes / Kayseri", lat: 38.531, lng: 35.45 },
    { name: "Kış turizmi", location: "Kartalkaya / Bolu", lat: 40.59, lng: 31.803 },
    { name: "Termal turizm", location: "Afyonkarahisar", lat: 38.756, lng: 30.538 },
    { name: "Termal turizm", location: "Yalova", lat: 40.65, lng: 29.266 },
    {
      name: "Kış turizmi",
      location: "Davraz / Isparta",
      lat: 37.751,
      lng: 30.819,
      note: "Davraz Kayak Merkezi, Akdeniz Bölgesi'nin iç kesimindeki yükselti farkına bağlı kış turizmi örneğidir.",
    },
    {
      name: "Kış turizmi",
      location: "Ilgaz Dağı / Kastamonu-Çankırı",
      lat: 40.97,
      lng: 33.7,
      note: "Ilgaz Dağı, Karadeniz'in iç kesimindeki kış turizmi merkezlerinden biridir.",
    },
    {
      name: "Termal turizm",
      location: "Kızılcahamam / Ankara",
      lat: 40.467,
      lng: 32.65,
      note: "Kızılcahamam, İç Anadolu'nun orman ve termal kaynak bakımından zengin termal turizm örneğidir.",
    },
  ],
});

addGroup({
  topic: "port",
  category: "port_trade",
  region: "Marmara / Ege / Akdeniz",
  note: "Büyük dış ticaret limanları hinterland, sanayi, demiryolu-karayolu bağlantısı ve dış ticaret hacmiyle KPSS'de öne çıkar.",
  items: [
    { name: "Mersin Limanı", location: "Mersin", lat: 36.812, lng: 34.641 },
    { name: "İzmir Limanı", location: "İzmir", lat: 38.423, lng: 27.142 },
    { name: "Ambarlı Limanı", location: "Avcılar / İstanbul", lat: 40.973, lng: 28.692 },
    { name: "İskenderun Limanı", location: "İskenderun / Hatay", lat: 36.587, lng: 36.173 },
    { name: "Derince Limanı", location: "İzmit / Kocaeli", lat: 40.766, lng: 29.917 },
    {
      name: "Haydarpaşa Limanı",
      location: "Kadıköy / İstanbul",
      lat: 41.001,
      lng: 29.018,
      note: "Haydarpaşa Limanı, Mersin ve İzmir'den sonra konteyner trafiğinde öne çıkan, demiryolu (TCDD) bağlantısıyla bilinen tarihi bir limandır.",
    },
    {
      name: "Aliağa Limanı",
      location: "Aliağa / İzmir",
      lat: 38.8,
      lng: 26.97,
      note: "Aliağa, rafineri-petrokimya tesisleri ve gemi söküm endüstrisiyle özdeşleşmiş bir liman bölgesidir.",
    },
    {
      name: "Gemlik Limanı",
      location: "Gemlik / Bursa",
      lat: 40.43,
      lng: 29.159,
      note: "Gemlik Limanı, Güney Marmara otomotiv ve sanayi hinterlandının dış ticaret çıkışlarından biridir.",
    },
  ],
});

addGroup({
  topic: "port",
  category: "port_regional",
  region: "Karadeniz / Marmara / Akdeniz",
  note: "Bölgesel limanlar, bulundukları kıyı kuşağının ticaret ve ulaşım bağlantılarını temsil eder.",
  items: [
    { name: "Samsun Limanı", location: "Samsun", lat: 41.286, lng: 36.33 },
    { name: "Trabzon Limanı", location: "Trabzon", lat: 41.005, lng: 39.722 },
    { name: "Bandırma Limanı", location: "Bandırma / Balıkesir", lat: 40.352, lng: 27.976 },
    { name: "Antalya Limanı", location: "Antalya", lat: 36.887, lng: 30.707 },
    {
      name: "Sinop Limanı",
      location: "Sinop",
      lat: 42.027,
      lng: 35.156,
      note: "Sinop, Karadeniz kıyısındaki tek doğal liman olmasıyla KPSS'de sıklıkla vurgulanır.",
    },
    {
      name: "Zonguldak Limanı",
      location: "Zonguldak",
      lat: 41.456,
      lng: 31.789,
      note: "Zonguldak Limanı, Türkiye'nin taşkömürü havzasının ihracat/ithalat çıkış noktası olarak bilinir.",
    },
    {
      name: "Tekirdağ Limanı",
      location: "Tekirdağ",
      lat: 40.978,
      lng: 27.51,
      note: "Tekirdağ Limanı, Trakya'nın tahıl üretimi ve sanayi bölgesiyle bağlantılı bir ihracat limanıdır.",
    },
    {
      name: "Rize Limanı",
      location: "Rize",
      lat: 41.025,
      lng: 40.517,
      note: "Rize Limanı, Doğu Karadeniz kıyı yerleşmeleri ve çay üretim alanlarıyla bağlantılı bölgesel liman örneğidir.",
    },
    {
      name: "Giresun Limanı",
      location: "Giresun",
      lat: 40.917,
      lng: 38.392,
      note: "Giresun Limanı, fındık üretim alanları ve Orta/Doğu Karadeniz kıyı bağlantısıyla ilişkilendirilir.",
    },
  ],
});

const collection = {
  type: "FeatureCollection",
  name: "turkey-economic-features",
  features,
};

await fs.writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`Wrote ${features.length} economic features to ${outputPath.pathname}`);
