// ==========================================================================
// 1. INISIALISASI PETA & CUSTOM PANE AGAR LAYER TIDAK TERTUMPUK
// ==========================================================================
const map = L.map("map", {
  center: [-5.3475, 105.3155], // Koordinat klaster bangunan_persil
  zoom: 17,
  zoomControl: false,
});

L.control.zoom({ position: "bottomright" }).addTo(map);

// Membuat 2 Pane terpisah agar `bangunan_persil` SELALU di atas `bgn_sementara`
map.createPane("basePane");
map.getPane("basePane").style.zIndex = 410;

map.createPane("persilPane");
map.getPane("persilPane").style.zIndex = 450;

// Basemap Satelit & Peta Terang
const basemaps = {
  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "&copy; Esri World Imagery",
      maxZoom: 20,
    },
  ),
  voyager: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 20,
    },
  ),
};

let currentBasemap = "satellite";
basemaps.satellite.addTo(map);

// ==========================================================================
// 2. STYLING LAYER BANGUNAN
// ==========================================================================

// Style untuk bgn_sementara.geojson (Bangunan tanpa atribut kadaster)
function styleBangunanSementara() {
  return {
    pane: "basePane",
    color: "#cbd5e1",
    weight: 1,
    opacity: 0.7,
    fillColor: "#64748b",
    fillOpacity: 0.35,
  };
}

// Style untuk bangunan_persil.geojson (Bangunan ber-NIB & Tipe Hak)
function styleBangunanPersil() {
  return {
    pane: "persilPane",
    color: "#a7f3d0", // Garis tepi hijau mint pastel cerah
    weight: 2,
    opacity: 1,
    fillColor: "#10b981", // Isi hijau zamrud cerah
    fillOpacity: 0.55,
  };
}

// Style saat bangunan dipilih/diklik
function styleSelectedBuilding(paneName) {
  return {
    pane: paneName,
    color: "#ffffff",
    weight: 3,
    opacity: 1,
    fillColor: "#f59e0b", // Sorotan kuning amber cerah saat aktif
    fillOpacity: 0.75,
  };
}

// ==========================================================================
// 3. MEMUAT DATA `bgn_sementara.geojson` & `bangunan_persil.geojson`
// ==========================================================================
let layerSementara = null;
let layerPersil = null;
let selectedLayer = null;
let selectedGroup = null;
let selectedBounds = null;

async function initWebGISData() {
  let countSementara = 0;
  let countPersil = 0;

  // 1. Muat bgn_sementara.geojson (Layer Bawah - Tanpa Informasi Kadaster)
  try {
    const resBase = await fetch("data/bgn_sementara.geojson");
    if (resBase.ok) {
      const dataBase = await resBase.json();
      const featuresBase = dataBase.features || [];
      countSementara = featuresBase.length;
      document.getElementById("baseCountBadge").textContent = countSementara;

      layerSementara = L.geoJSON(dataBase, {
        pane: "basePane",
        style: styleBangunanSementara,
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          const areaVal = p.Shape_Area
            ? Number(p.Shape_Area).toFixed(1)
            : estimateArea(layer);

          // Pop-up Glass minimalis berisi keterangan "Tidak Ada Informasi"
          const popupUnregistered = `
                        <div class="popup-glass-body">
                            <span class="popup-badge unregistered">NON-KADASTER</span>
                            <div class="popup-title">Tidak Ada Informasi</div>
                            <p class="popup-empty-msg">
                                Bangunan ini belum memiliki data atribut persil (NIB & Tipe Hak belum terdaftar).
                            </p>
                        </div>
                    `;
          layer.bindPopup(popupUnregistered);

          layer.on("click", () => {
            selectBuildingFeature(layer, layerSementara, "basePane", {
              hasCadastral: false,
              id: "TIDAK ADA INFORMASI",
              nib: "-",
              tipeHak: "TIDAK ADA INFORMASI",
              area: areaVal,
            });
          });
        },
      }).addTo(map);
    }
  } catch (err) {
    console.warn("Gagal memuat data/bgn_sementara.geojson:", err);
  }

  // 2. Muat bangunan_persil.geojson (Layer Atas - Memiliki NIB & Tipe_Hak)
  try {
    const resPersil = await fetch("data/bangunan_persil.geojson");
    if (resPersil.ok) {
      const dataPersil = await resPersil.json();
      const featuresPersil = dataPersil.features || [];
      countPersil = featuresPersil.length;
      document.getElementById("persilCountBadge").textContent = countPersil;

      const unitCardsList = document.getElementById("unitCardsList");
      unitCardsList.innerHTML = "";

      layerPersil = L.geoJSON(dataPersil, {
        pane: "persilPane",
        style: styleBangunanPersil,
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};

          // Ambil atribut asli dari bangunan_persil.geojson
          const nibVal = p.NIB || "-";
          const hakVal = p.TIPE_HAK || "HAK MILIK";
          const objId =
            p.OBJECTID_1 && p.OBJECTID_1 !== "0"
              ? p.OBJECTID_1
              : p.OBJECTID && p.OBJECTID !== "0"
                ? p.OBJECTID
                : p.OBJECTID_2 || "-";
          const areaVal = p.Shape_Area
            ? Number(p.Shape_Area).toFixed(2)
            : estimateArea(layer);

          // Pop-up Glass Transparan untuk Bangunan Persil
          const popupRegistered = `
                        <div class="popup-glass-body">
                            <span class="popup-badge registered">TERDAFTAR KADASTER</span>
                            <div class="popup-title">NIB: ${nibVal}</div>
                            <div class="popup-row">
                                <span>Tipe Hak</span>
                                <span style="color:#fde68a;">${hakVal}</span>
                            </div>
                            <div class="popup-row">
                                <span>Luas Bangunan</span>
                                <span>${areaVal} m²</span>
                            </div>
                            <div class="popup-row">
                                <span>ID Objek</span>
                                <span>#${objId}</span>
                            </div>
                        </div>
                    `;
          layer.bindPopup(popupRegistered);

          layer.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            selectBuildingFeature(layer, layerPersil, "persilPane", {
              hasCadastral: true,
              id: `#${objId}`,
              nib: nibVal,
              tipeHak: hakVal,
              area: areaVal,
            });
          });

          layer.on("mouseover", () => {
            if (layer !== selectedLayer) {
              layer.setStyle({ weight: 3, fillOpacity: 0.75 });
            }
          });
          layer.on("mouseout", () => {
            if (layer !== selectedLayer) {
              layerPersil.resetStyle(layer);
            }
          });

          // Buat kartu di daftar bawah hanya untuk Bangunan Persil
          const card = document.createElement("div");
          card.className = "unit-card";
          card.innerHTML = `
                        <span class="status-dot"></span>
                        <span class="unit-code">NIB ${nibVal}</span>
                        <i class="ri-arrow-right-up-line unit-arrow"></i>
                    `;
          card.addEventListener("click", () => {
            selectBuildingFeature(layer, layerPersil, "persilPane", {
              hasCadastral: true,
              id: `#${objId}`,
              nib: nibVal,
              tipeHak: hakVal,
              area: areaVal,
            });
            map.flyToBounds(layer.getBounds(), { maxZoom: 19, duration: 0.8 });
            layer.openPopup();
          });

          layer._cardElement = card;
          unitCardsList.appendChild(card);
        },
      }).addTo(map);
    }
  } catch (err) {
    console.warn("Gagal memuat data/bangunan_persil.geojson:", err);
  }

  // Fokus otomatis ke klaster bangunan_persil saat pertama kali dibuka
  if (layerPersil && layerPersil.getLayers().length > 0) {
    map.fitBounds(layerPersil.getBounds(), { padding: [70, 70] });
  } else if (layerSementara && layerSementara.getLayers().length > 0) {
    map.fitBounds(layerSementara.getBounds(), { padding: [70, 70] });
  }

  // Update rasio kelengkapan di kartu bawah inspector
  if (countSementara > 0 && countPersil > 0) {
    const pct = Math.min(100, Math.round((countPersil / countSementara) * 100));
    document.getElementById("completenessPct").textContent = `${pct}%`;
    document.getElementById("completenessText").textContent =
      `${countPersil} BANGUNAN MEMILIKI ATRIBUT NIB`;
  }
}

// ==========================================================================
// 4. FUNGSI UPDATE FLOATING INSPECTOR CARD (GLASS)
// ==========================================================================
function selectBuildingFeature(layer, groupLayer, paneName, info) {
  if (selectedLayer && selectedGroup) {
    selectedGroup.resetStyle(selectedLayer);
    if (selectedLayer._cardElement)
      selectedLayer._cardElement.classList.remove("active");
  }

  selectedLayer = layer;
  selectedGroup = groupLayer;
  selectedBounds = layer.getBounds();

  layer.setStyle(styleSelectedBuilding(paneName));

  if (layer._cardElement) {
    layer._cardElement.classList.add("active");
    layer._cardElement.scrollIntoView({ behavior: "smooth", inline: "center" });
  }

  const dot = document.getElementById("detailDot");
  const badge = document.getElementById("detailBadge");
  const previewTag = document.getElementById("previewTag");

  if (info.hasCadastral) {
    dot.style.background = "#34d399";
    dot.style.boxShadow = "0 0 8px #34d399";
    badge.textContent = "TERDAFTAR";
    badge.style.color = "#a7f3d0";
    badge.style.background = "rgba(52, 211, 153, 0.25)";
    previewTag.textContent = "BANGUNAN PERSIL (AKTIF)";
    document.getElementById("detailNIB").textContent = `NIB: ${info.nib}`;
  } else {
    dot.style.background = "#fbbf24";
    dot.style.boxShadow = "none";
    badge.textContent = "TANPA ATRIBUT";
    badge.style.color = "#fde68a";
    badge.style.background = "rgba(251, 191, 36, 0.22)";
    previewTag.textContent = "TIDAK ADA INFORMASI KADASTER";
    document.getElementById("detailNIB").textContent = "NON-PERSIL";
  }

  document.getElementById("detailId").textContent = info.id;
  document.getElementById("detailNibFull").textContent = info.nib;
  document.getElementById("detailTipeHak").textContent = info.tipeHak;
  document.getElementById("detailArea").textContent = `${info.area} m²`;
}

function estimateArea(layer) {
  if (!layer.getBounds) return 0;
  const b = layer.getBounds();
  const w = b.getNorthEast().distanceTo(b.getNorthWest());
  const h = b.getNorthEast().distanceTo(b.getSouthEast());
  return (w * h * 0.65).toFixed(1);
}

// ==========================================================================
// 5. EVENT LISTENER NAVIGASI & TOMBOL SIDEBAR
// ==========================================================================
const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("toggleSidebar");
const toggleIcon = document.getElementById("toggleIcon");

toggleBtn.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  toggleIcon.className = sidebar.classList.contains("collapsed")
    ? "ri-arrow-right-s-line"
    : "ri-arrow-left-s-line";
});

// Fokus ke Bangunan Persil
document.getElementById("btnZoomPersil").addEventListener("click", () => {
  if (layerPersil && layerPersil.getLayers().length > 0) {
    map.flyToBounds(layerPersil.getBounds(), {
      padding: [70, 70],
      duration: 1,
    });
  }
});

// Fokus ke Semua Bangunan (bgn_sementara)
document.getElementById("btnZoomAll").addEventListener("click", () => {
  if (layerSementara && layerSementara.getLayers().length > 0) {
    map.flyToBounds(layerSementara.getBounds(), {
      padding: [70, 70],
      duration: 1,
    });
  }
});

// Toggle Layer Bangunan Persil
let persilVisible = true;
document
  .getElementById("btnTogglePersil")
  .addEventListener("click", function () {
    if (!layerPersil) return;
    if (persilVisible) {
      map.removeLayer(layerPersil);
      this.style.opacity = "0.5";
    } else {
      map.addLayer(layerPersil);
      this.style.opacity = "1";
    }
    persilVisible = !persilVisible;
  });

// Toggle Layer Bangunan Sementara
let baseVisible = true;
document.getElementById("btnToggleBase").addEventListener("click", function () {
  if (!layerSementara) return;
  if (baseVisible) {
    map.removeLayer(layerSementara);
    this.style.opacity = "0.5";
  } else {
    map.addLayer(layerSementara);
    this.style.opacity = "1";
  }
  baseVisible = !baseVisible;
});

// Ganti Basemap
document.getElementById("btnSwitchBasemap").addEventListener("click", () => {
  if (currentBasemap === "satellite") {
    map.removeLayer(basemaps.satellite);
    basemaps.voyager.addTo(map);
    currentBasemap = "voyager";
  } else {
    map.removeLayer(basemaps.voyager);
    basemaps.satellite.addTo(map);
    currentBasemap = "satellite";
  }
});

// Reset Sorotan
document.getElementById("btnResetSelection").addEventListener("click", () => {
  if (selectedLayer && selectedGroup) {
    selectedGroup.resetStyle(selectedLayer);
    if (selectedLayer._cardElement)
      selectedLayer._cardElement.classList.remove("active");
  }
  map.closePopup();
});

// Perbesar ke Bangunan yang Dipilih
document.getElementById("btnZoomSelected").addEventListener("click", () => {
  if (selectedBounds) {
    map.flyToBounds(selectedBounds, { maxZoom: 20, duration: 0.7 });
  }
});

// Scroll Daftar Kartu di Bawah
const cardsContainer = document.getElementById("unitCardsList");
document.getElementById("scrollLeft").addEventListener("click", () => {
  cardsContainer.scrollBy({ left: -240, behavior: "smooth" });
});
document.getElementById("scrollRight").addEventListener("click", () => {
  cardsContainer.scrollBy({ left: 240, behavior: "smooth" });
});

// Jam Realtime
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  document.getElementById("live-clock").innerHTML =
    `<i class="ri-time-fill"></i> ${timeStr} WIB`;
}
setInterval(updateClock, 1000);
updateClock();

// Jalankan saat halaman siap
initWebGISData();
