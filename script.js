// ==========================================================================
// 1. INISIALISASI PETA 3D MAPLIBRE GL JS
// ==========================================================================
const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const map = new maplibregl.Map({
  container: "map",
  style: DARK_STYLE,
  center: [105.315, -5.362], // Titik awal Desa Way Hui
  zoom: 14.5,
  pitch: 55, // Kemiringan 3D aktif
  bearing: -15,
  antialias: true,
});

map.addControl(
  new maplibregl.NavigationControl({ visualizePitch: true }),
  "bottom-right",
);

let allBounds = null;
let kritisBounds = null;
let isSatellite = false;

// Fungsi menghitung Bounding Box dari GeoJSON secara otomatis
function getGeoJSONBounds(geojson) {
  const bounds = new maplibregl.LngLatBounds();
  const processCoords = (coords) => {
    if (typeof coords[0] === "number") {
      bounds.extend(coords);
    } else {
      coords.forEach(processCoords);
    }
  };
  (geojson.features || []).forEach((f) => {
    if (f.geometry && f.geometry.coordinates) {
      processCoords(f.geometry.coordinates);
    }
  });
  return bounds;
}

// ==========================================================================
// 2. MEMUAT SELURUH LAYER DARI FOLDER `data_fiks/`
// ==========================================================================
map.on("load", async () => {
  // Layer 0: Basemap Satelit Esri (Disembunyikan di awal, aktif saat tombol Basemap diklik)
  map.addSource("esri-sat", {
    type: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    tileSize: 256,
  });
  map.addLayer({
    id: "esri-sat-layer",
    type: "raster",
    source: "esri-sat",
    layout: { visibility: "none" },
  });

  // 1. Layer Zona Gerakan Tanah (zkgt_fiks.geojson - Simbologi Field "Unsur")
  map.addSource("zona", {
    type: "geojson",
    data: "data_fiks/zkgt_fiks.geojson",
  });
  map.addLayer({
    id: "zona-fill",
    type: "fill",
    source: "zona",
    paint: {
      "fill-color": [
        "case",
        [
          "in",
          "menengah",
          ["downcase", ["coalesce", ["to-string", ["get", "Unsur"]], ""]],
        ],
        "#fdba74", // Warna Peach/Oranye Muda untuk Menengah (sesuai Peta Lampiran 1)
        "#fef9c3", // Warna Krem/Kuning Pucat untuk Rendah (sesuai Peta Lampiran 1)
      ],
      "fill-opacity": 0.35, // Transparan agar basemap/ortofoto tetap terlihat jelas
      "fill-outline-color": "#64748b", // Garis batas tipis pemisah zona Menengah & Rendah
    },
  });

  // 2. Layer Buffer Aliran 15m (Biru Sian sesuai Peta 2)
  map.addSource("buffer_aliran", {
    type: "geojson",
    data: "data_fiks/buffered.geojson",
  });
  map.addLayer({
    id: "buffer-fill",
    type: "fill",
    source: "buffer_aliran",
    paint: {
      "fill-color": "#38bdf8",
      "fill-opacity": 0.55,
    },
  });

  // 3. Layer Jaringan Jalan (Abu-abu sesuai Peta 3)
  map.addSource("jalan", {
    type: "geojson",
    data: "data_fiks/jlan_cba.geojson",
  });
  map.addLayer({
    id: "jalan-line",
    type: "line",
    source: "jalan",
    paint: {
      "line-color": "#94a3b8",
      "line-width": 1.4,
      "line-opacity": 0.75,
    },
  });

  // 4. Layer Area Titik Kumpul (Oker/Emas sesuai Peta 3)
  map.addSource("area_kumpul", {
    type: "geojson",
    data: "data_fiks/titik_kumpul_area.geojson",
  });
  map.addLayer({
    id: "area-kumpul-fill",
    type: "fill",
    source: "area_kumpul",
    paint: {
      "fill-color": "#ca8a04",
      "fill-opacity": 0.75,
    },
  });

  // 5. Layer 3D Bangunan Zona Rendah (Kuning Cerah sesuai Peta 1, Tinggi 3.5-3.8m PU)
  map.addSource("bgn_rendah", {
    type: "geojson",
    data: "data_fiks/bgn_rendah.geojson",
    generateId: true,
  });
  map.addLayer({
    id: "bgn-rendah-3d",
    type: "fill-extrusion",
    source: "bgn_rendah",
    paint: {
      "fill-extrusion-color": "#facc15",
      "fill-extrusion-height": 3.5,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 1,
      "fill-extrusion-vertical-gradient": true,
    },
  });

  // 6. Layer 3D Bangunan Zona Menengah (Oranye sesuai Peta 1, Tinggi 4.0m PU)
  map.addSource("bgn_menengah", {
    type: "geojson",
    data: "data_fiks/bgn_menengah.geojson",
    generateId: true,
  });
  map.addLayer({
    id: "bgn-menengah-3d",
    type: "fill-extrusion",
    source: "bgn_menengah",
    paint: {
      "fill-extrusion-color": "#f97316",
      "fill-extrusion-height": 3.5,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 1,
      "fill-extrusion-vertical-gradient": true,
    },
  });

  // 7. Layer 3D Klaster Bangunan Kritis [891 Unit] (Merah Menyala sesuai Peta 2 & 3, Tinggi 4.0m PU)
  map.addSource("bgn_kritis", {
    type: "geojson",
    data: "data_fiks/bgn_kritis.geojson",
    generateId: true,
  });
  map.addLayer({
    id: "bgn-kritis-3d",
    type: "fill-extrusion",
    source: "bgn_kritis",
    paint: {
      "fill-extrusion-color": "#ef4444",
      "fill-extrusion-height": 3.8,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 1,
      "fill-extrusion-vertical-gradient": true,
    },
  });

  // 8. Layer Poin Titik Kumpul Evakuasi (Hijau sesuai Peta 3)
  map.addSource("titik_kumpul", {
    type: "geojson",
    data: "data_fiks/titik_kumpul_poin.geojson",
  });
  map.addLayer({
    id: "titik-kumpul-circle",
    type: "circle",
    source: "titik_kumpul",
    paint: {
      "circle-radius": 8,
      "circle-color": "#16a34a",
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#ffffff",
    },
  });

  // 9. Layer Outline Batas Desa (batas_desa.geojson)
  map.addSource("batas_desa", {
    type: "geojson",
    data: "data_fiks/batas_desa.geojson",
  });
  map.addLayer({
    id: "batas-desa-line",
    type: "line",
    source: "batas_desa",
    paint: {
      "line-color": "#ffffff",
      "line-width": 2.2,
      "line-dasharray": [3, 2], // Garis putus-putus tegas khas batas administrasi
      "line-opacity": 0.9,
    },
  });

  // Muat Nama Desa & Pasang Label di Titik Tengah (Centroid) Poligon
  try {
    const resDesa = await fetch("data_fiks/batas_desa.geojson");
    if (resDesa.ok) {
      const dataDesa = await resDesa.json();
      renderLabelDesa(dataDesa.features || []);
    }
  } catch (err) {
    console.warn("Gagal memuat batas_desa.geojson:", err);
  }

  // Fungsi memberi celah tipis antar-poligon bangunan yang berdempetan
  function beriCelahBangunan(geojson, scale = 0.92) {
    const shrinkRing = (ring) => {
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      ring.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return ring.map(([x, y]) => [
        cx + (x - cx) * scale,
        cy + (y - cy) * scale,
      ]);
    };

    geojson.features = (geojson.features || []).map((f) => {
      if (!f.geometry) return f;
      if (f.geometry.type === "Polygon") {
        f.geometry.coordinates = f.geometry.coordinates.map(shrinkRing);
      } else if (f.geometry.type === "MultiPolygon") {
        f.geometry.coordinates = f.geometry.coordinates.map((poly) =>
          poly.map(shrinkRing),
        );
      }
      return f;
    });
    return geojson;
  }

  // Hitung batas koordinat, pisahkan bangunan dempet, & buat kartu 6 Titik Kumpul
  try {
    const [resZona, resRendah, resKritis, resMenengah, resTK] =
      await Promise.all([
        fetch("data_fiks/zkgt_fiks.geojson"),
        fetch("data_fiks/bgn_rendah.geojson"),
        fetch("data_fiks/bgn_kritis.geojson"),
        fetch("data_fiks/bgn_menengah.geojson"),
        fetch("data_fiks/titik_kumpul_poin.geojson"),
      ]);

    if (resZona.ok) {
      const dataZona = await resZona.json();
      allBounds = getGeoJSONBounds(dataZona);
      if (!allBounds.isEmpty()) {
        map.fitBounds(allBounds, {
          padding: 60,
          pitch: 55,
          bearing: -15,
          duration: 1200,
        });
      }
    }

    if (resRendah.ok) {
      const dataRendah = await resRendah.json();
      map.getSource("bgn_rendah").setData(beriCelahBangunan(dataRendah, 0.92));
    }

    if (resKritis.ok && resMenengah.ok) {
      const dataKritis = await resKritis.json();
      const dataMenengah = await resMenengah.json();
      kritisBounds = getGeoJSONBounds(dataKritis);

      // Saring keluar bangunan kritis dari layer menengah agar tidak bertumpuk
      const kritisKeys = new Set(
        (dataKritis.features || []).map((f) =>
          JSON.stringify(f.geometry.coordinates[0][0]),
        ),
      );
      dataMenengah.features = (dataMenengah.features || []).filter(
        (f) => !kritisKeys.has(JSON.stringify(f.geometry.coordinates[0][0])),
      );

      map.getSource("bgn_kritis").setData(beriCelahBangunan(dataKritis, 0.92));
      map
        .getSource("bgn_menengah")
        .setData(beriCelahBangunan(dataMenengah, 0.92));
    }

    if (resTK.ok) {
      const dataTK = await resTK.json();
      renderTitikKumpulCards(dataTK.features || []);
    }
  } catch (err) {
    console.warn(
      "Pastikan server lokal berjalan di folder webgis_kadmul:",
      err,
    );
  }

  // Interaksi Klik pada Bangunan 3D & Titik Kumpul
  setupMapInteractions();
});

// ==========================================================================
// 3. DAFTAR 6 KARTU TITIK KUMPUL DI DOCK BAWAH & INTERAKSI KLIK
// ==========================================================================
const romawi = ["I", "II", "III", "IV", "V", "VI"];

function renderTitikKumpulCards(features) {
  const container = document.getElementById("tkCardsList");
  container.innerHTML = "";

  features.forEach((f, idx) => {
    const p = f.properties || {};
    const kode = `TK-${romawi[idx] || idx + 1}`;
    const luas = Number(p.Luas_m2 || 0).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    });
    const kap = Number(p.Kapasitas || 0).toLocaleString("id-ID");
    const coords = f.geometry.coordinates;

    const card = document.createElement("div");
    card.className = "unit-card";
    card.innerHTML = `
      <span class="status-dot"></span>
      <span class="unit-code">${kode} (${kap} Jiwa)</span>
    `;

    card.addEventListener("click", () => {
      document
        .querySelectorAll(".unit-card")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      map.flyTo({ center: coords, zoom: 17.2, pitch: 60, duration: 1000 });

      updateInspectorCard({
        badge: "TITIK KUMPUL AMAN",
        color: "#34d399",
        title: `Lokasi Evakuasi ${kode}`,
        r1: ["Zona Kerentanan", `${p.Unsur || "Rendah"} (Skor ${p.SKOR || 2})`],
        r2: ["Luas Area Terbuka", `${luas} m²`],
        r3: ["Daya Tampung (2m²/org)", `${kap} Jiwa`],
        r4: ["Kode Wilayah", p.LCODE || "MB03050260"],
      });

      new maplibregl.Popup({ offset: 12 })
        .setLngLat(coords)
        .setHTML(
          `
          <div style="font-size:12px;">
            <strong style="color:#6ee7b7;">${kode} - Titik Kumpul Aman</strong><br/>
            Luas Lahan: <b>${luas} m²</b><br/>
            Kapasitas: <b style="color:#fde047;">${kap} Jiwa</b>
          </div>
        `,
        )
        .addTo(map);
    });

    container.appendChild(card);
  });
}

function setupMapInteractions() {
  // Klik Klaster Bangunan Kritis
  map.on("click", "bgn-kritis-3d", (e) => {
    updateInspectorCard({
      badge: "PRIORITAS MITIGASI",
      color: "#ef4444",
      title: "Klaster Bangunan Kritis",
      r1: ["Status Zona", "Zona Menengah (Skor 2,6)"],
      r2: ["Posisi Hidrologi", "Dalam Buffer 15m Aliran"],
      r3: ["Total Klaster Kritis", "891 Unit (15,51%)"],
      r4: ["Rekomendasi", "Evakuasi ke 6 Titik Kumpul"],
    });
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `
        <div style="font-size:12px;">
          <strong style="color:#ef4444;">Bangunan Kritis (Buffer 15m)</strong><br/>
          Zona: Menengah (Skor Bobot 2,6)<br/>
          Prioritas utama mitigasi drainase & evakuasi.
        </div>
      `,
      )
      .addTo(map);
  });

  // Klik Bangunan Menengah
  map.on("click", "bgn-menengah-3d", (e) => {
    // Abaikan jika titik yang diklik adalah Bangunan Kritis
    const hitKritis = map.queryRenderedFeatures(e.point, {
      layers: ["bgn-kritis-3d"],
    });
    if (hitKritis.length > 0) return;

    updateInspectorCard({
      badge: "ZONA MENENGAH",
      color: "#f97316",
      title: "Bangunan Terdampak Menengah",
      r1: ["Luas Zona Menengah", "253,63 Ha"],
      r2: ["Jumlah Bangunan", "5.746 Unit"],
      r3: ["Kerapatan Aliran", "126,41 m/Ha"],
      r4: ["Skor Bobot (60:40)", "2,6 (Menengah)"],
    });
  });

  // Klik Bangunan Rendah
  map.on("click", "bgn-rendah-3d", (e) => {
    updateInspectorCard({
      badge: "ZONA RENDAH",
      color: "#facc15",
      title: "Bangunan Terdampak Rendah",
      r1: ["Luas Zona Rendah", "343,88 Ha"],
      r2: ["Jumlah Bangunan", "8.405 Unit"],
      r3: ["Kerapatan Aliran", "130,46 m/Ha"],
      r4: ["Skor Bobot (60:40)", "2,4 (Rendah)"],
    });
  });

  // Ubah kursor saat melewati layer interaktif
  [
    "bgn-kritis-3d",
    "bgn-menengah-3d",
    "bgn-rendah-3d",
    "titik-kumpul-circle",
  ].forEach((id) => {
    map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
  });
}

function updateInspectorCard(info) {
  document.getElementById("detailDot").style.background = info.color;
  document.getElementById("detailDot").style.boxShadow =
    `0 0 8px ${info.color}`;
  document.getElementById("detailBadge").textContent = info.badge;
  document.getElementById("detailTitle").textContent = info.title;

  document.getElementById("lblRow1").textContent = info.r1[0];
  document.getElementById("valRow1").textContent = info.r1[1];
  document.getElementById("lblRow2").textContent = info.r2[0];
  document.getElementById("valRow2").textContent = info.r2[1];
  document.getElementById("lblRow3").textContent = info.r3[0];
  document.getElementById("valRow3").textContent = info.r3[1];
  document.getElementById("lblRow4").textContent = info.r4[0];
  document.getElementById("valRow4").textContent = info.r4[1];
}

// ==========================================================================
// 4. TOMBOL KONTROL UI (2D/3D, LAYER TOGGLE, SIDEBAR, BASEMAP)
// ==========================================================================
// Toggle 2D (LOD-0) vs 3D (LOD-1)
document.getElementById("btnLod0").addEventListener("click", function () {
  this.classList.add("active");
  document.getElementById("btnLod1").classList.remove("active");
  map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
  map.setPaintProperty("bgn-rendah-3d", "fill-extrusion-height", 0);
  map.setPaintProperty("bgn-menengah-3d", "fill-extrusion-height", 0);
  map.setPaintProperty("bgn-kritis-3d", "fill-extrusion-height", 0);
});

document.getElementById("btnLod1").addEventListener("click", function () {
  this.classList.add("active");
  document.getElementById("btnLod0").classList.remove("active");
  map.easeTo({ pitch: 55, bearing: -15, duration: 800 });
  map.setPaintProperty("bgn-rendah-3d", "fill-extrusion-height", 3.5);
  map.setPaintProperty("bgn-menengah-3d", "fill-extrusion-height", 3.5);
  map.setPaintProperty("bgn-kritis-3d", "fill-extrusion-height", 3.8);
});

// Toggle On/Off Layer di Sidebar
document.querySelectorAll(".menu-item[data-layer]").forEach((item) => {
  item.addEventListener("click", function () {
    const layerId = this.getAttribute("data-layer");
    const vis = map.getLayoutProperty(layerId, "visibility");
    if (vis === "none") {
      map.setLayoutProperty(layerId, "visibility", "visible");
      this.classList.add("active");
    } else {
      map.setLayoutProperty(layerId, "visibility", "none");
      this.classList.remove("active");
    }
  });
});

// Fokus Kamera: Seluruh Wilayah (Mode Warna Peta 1: Oranye & Kuning)
document.getElementById("btnFocusAll").addEventListener("click", function () {
  this.classList.add("active");
  document.getElementById("btnFocusKritis").classList.remove("active");
  map.setPaintProperty("bgn-menengah-3d", "fill-extrusion-color", "#f97316");
  map.setPaintProperty("bgn-rendah-3d", "fill-extrusion-color", "#facc15");
  if (allBounds && !allBounds.isEmpty()) {
    map.fitBounds(allBounds, {
      padding: 60,
      pitch: 55,
      bearing: -15,
      duration: 1000,
    });
  }
});

// Fokus Kamera: Klaster Kritis (Mode Warna Peta 2: Non-Kritis menjadi Abu-abu)
document
  .getElementById("btnFocusKritis")
  .addEventListener("click", function () {
    this.classList.add("active");
    document.getElementById("btnFocusAll").classList.remove("active");
    map.setPaintProperty("bgn-menengah-3d", "fill-extrusion-color", "#94a3b8");
    map.setPaintProperty("bgn-rendah-3d", "fill-extrusion-color", "#cbd5e1");
    if (kritisBounds && !kritisBounds.isEmpty()) {
      map.fitBounds(kritisBounds, {
        padding: 80,
        pitch: 60,
        bearing: -10,
        duration: 1000,
      });
    }
  });

// Ganti Basemap Gelap / Satelit
document.getElementById("btnSwitchBasemap").addEventListener("click", () => {
  isSatellite = !isSatellite;
  map.setLayoutProperty(
    "esri-sat-layer",
    "visibility",
    isSatellite ? "visible" : "none",
  );
});

// Reset Ringkasan Inspector
document.getElementById("btnResetInfo").addEventListener("click", () => {
  updateInspectorCard({
    badge: "RINGKASAN ANALISIS",
    color: "#34d399",
    title: "Desa Way Hui (597,51 Ha)",
    r1: ["Zona Menengah (253,63 Ha)", "Skor 2,6"],
    r2: ["Zona Rendah (343,88 Ha)", "Skor 2,4"],
    r3: ["Klaster Bangunan Kritis", "891 Unit"],
    r4: ["Total Kapasitas Evakuasi", "41.902 Jiwa"],
  });
});

// Buka/Tutup Sidebar (Sinkron dengan Header & Dock + Otomatis Kecil di HP)
const sidebar = document.getElementById("sidebar");
const toggleIcon = document.getElementById("toggleIcon");

function setSidebarCollapsed(isCollapsed) {
  sidebar.classList.toggle("collapsed", isCollapsed);
  document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  toggleIcon.className = isCollapsed
    ? "ri-arrow-right-s-line"
    : "ri-arrow-left-s-line";
}

document.getElementById("toggleSidebar").addEventListener("click", () => {
  setSidebarCollapsed(!sidebar.classList.contains("collapsed"));
});

// Jika dibuka di layar HP (<= 768px), otomatis kecilkan sidebar di awal
if (window.innerWidth <= 768) {
  setSidebarCollapsed(true);
}

// Koordinat Realtime Mengikuti Pergerakan Mouse
const coordDisplay = document.getElementById("live-clock");
coordDisplay.innerHTML = `<i class="ri-crosshair-2-line"></i> -5.36200, 105.31500`;

map.on("mousemove", (e) => {
  const lat = e.lngLat.lat.toFixed(5);
  const lng = e.lngLat.lng.toFixed(5);
  coordDisplay.innerHTML = `<i class="ri-crosshair-2-line"></i> ${lat}, ${lng}`;
});

// ==========================================================================
// 5. FUNGSI LABEL NAMA DESA OTOMATIS & TOGGLE ON/OFF
// ==========================================================================
const desaMarkers = [];

function getPolygonCentroid(coords) {
  // Mengambil ring terluar dari Polygon atau MultiPolygon
  const ring = Array.isArray(coords[0][0][0]) ? coords[0][0] : coords[0];
  let area = 0,
    cx = 0,
    cy = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (area === 0) return ring[0];
  return [cx / (3 * area), cy / (3 * area)];
}

function renderLabelDesa(features) {
  features.forEach((f) => {
    if (!f.geometry || !f.geometry.coordinates) return;
    const p = f.properties || {};
    // Membaca kolom nama desa dari standar RBI (NAMOBJ / WADMKD / DESA)
    const namaDesa =
      p.NAMOBJ || p.WADMKD || p.DESA || p.Nama_Desa || p.nama || "";
    if (!namaDesa) return;

    const center = getPolygonCentroid(f.geometry.coordinates);
    const el = document.createElement("div");
    el.className = "desa-label-marker";
    el.textContent = namaDesa;

    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat(center)
      .addTo(map);

    desaMarkers.push(marker);
  });
}

// Sinkronkan tampil/sembunyi label nama desa dengan tombol Batas Desa di Sidebar
const btnToggleDesa = document.getElementById("btnToggleDesa");
if (btnToggleDesa) {
  btnToggleDesa.addEventListener("click", function () {
    const isVisible = this.classList.contains("active");
    desaMarkers.forEach((m) => {
      m.getElement().style.display = isVisible ? "block" : "none";
    });
  });
}
