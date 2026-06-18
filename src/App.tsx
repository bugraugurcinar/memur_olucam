import { useCallback, useMemo, useState } from "react";
import { LayerStatus } from "./components/LayerStatus";
import { geoJsonAttribution, geoJsonSources } from "./geojson/sources";
import { useGeoJson } from "./hooks/useGeoJson";
import { TurkeyMap } from "./maps/TurkeyMap";

function App() {
  const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);
  const country = useGeoJson(geoJsonSources.country.url);
  const provinces = useGeoJson(geoJsonSources.provinces.url);

  const provinceCount = provinces.data?.features.length ?? 0;
  const isLoading = country.isLoading || provinces.isLoading;
  const error = country.error ?? provinces.error;

  const selectedText = useMemo(
    () => selectedProvinceName ?? "Henüz seçilmedi",
    [selectedProvinceName],
  );

  const handleProvinceSelect = useCallback((provinceName: string) => {
    setSelectedProvinceName(provinceName);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="phase-label">Phase 1</span>
          <h1>KPSS Coğrafya Atlas</h1>
        </div>
        <div className="header-metrics" aria-label="Harita veri durumu">
          <span>ADM0</span>
          <strong>{country.data ? "Hazır" : "Yükleniyor"}</strong>
          <span>ADM1</span>
          <strong>{provinceCount || "..."}</strong>
        </div>
      </header>

      <main className="atlas-layout">
        <section className="map-stage">
          <TurkeyMap
            countryData={country.data}
            provincesData={provinces.data}
            selectedProvinceName={selectedProvinceName}
            onProvinceSelect={handleProvinceSelect}
          />

          {(isLoading || error) && (
            <div className="map-state" role="status">
              <strong>{error ? "Harita verisi yüklenemedi" : "Harita hazırlanıyor"}</strong>
              <span>{error ?? "Türkiye ve il sınırları GeoJSON katmanları yükleniyor."}</span>
            </div>
          )}
        </section>

        <aside className="side-panel" aria-label="Harita katmanları">
          <div className="panel-section">
            <h2>Katmanlar</h2>
            <LayerStatus
              label={geoJsonSources.country.label}
              detail={geoJsonSources.country.sourceName}
              isReady={Boolean(country.data)}
            />
            <LayerStatus
              label={geoJsonSources.provinces.label}
              detail={`${provinceCount || 81} il`}
              isReady={Boolean(provinces.data)}
            />
          </div>

          <div className="panel-section">
            <h2>Seçili il</h2>
            <p className="selected-province">{selectedText}</p>
          </div>

          <p className="attribution">{geoJsonAttribution}</p>
        </aside>
      </main>
    </div>
  );
}

export default App;
