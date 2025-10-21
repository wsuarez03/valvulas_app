// === Configuración ===
const DB_NAME = 'valvulasDB';
const STORE_NAME = 'hojas';
let db;

window.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  initDB();
  el('photoInput').addEventListener('change', e => handlePhoto(e, 'photoPreview'));
  el('photoPlacaInput').addEventListener('change', e => handlePhoto(e, 'photoPlacaPreview'));
  el('saveBtn').addEventListener('click', saveLocal);

  // acciones grupales
  el('pdfSelectedBtn').addEventListener('click', generateSelectedPDFs);
  el('shareSelectedBtn').addEventListener('click', shareSelected);
  el('deleteSelectedBtn').addEventListener('click', deleteSelected);
  el('exportSelectedPhotosBtn').addEventListener('click', exportSelectedPhotos);
}

// === IndexedDB ===
function initDB() {
  const request = indexedDB.open(DB_NAME, 2);
  request.onupgradeneeded = e => {
    const db = e.target.result;
    if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME);
    db.createObjectStore(STORE_NAME, { keyPath: 'serie' });
  };
  request.onsuccess = e => {
    db = e.target.result;
    renderSaved();
  };
  request.onerror = e => console.error('IndexedDB error:', e);
}

function addToDB(data, cb) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const req = store.put(data);
  req.onsuccess = () => cb();
}

function getAllFromDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e);
  });
}

function deleteFromDB(serie, cb) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const req = store.delete(serie);
  req.onsuccess = () => cb();
}

// === Utilidad ===
function el(id) { return document.getElementById(id); }

// === Foto preview ===
function handlePhoto(e, previewId) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = el(previewId);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// === Guardar ===
function saveLocal() {
  const data = readFormData();
  if (!data.serie) return alert('⚠️ Ingrese la Serie.');
  addToDB(data, () => {
    alert('✅ Guardado localmente');
    renderSaved();
    el('valveForm').reset();
    el('photoPreview').src = '';
    el('photoPlacaPreview').src = '';
  });
}

function readFormData() {
  return {
    cliente: el('cliente').value,
    tag: el('tag').value,
    marca: el('marca').value,
    modelo: el('modelo').value,
    tamano: el('tamano').value,
    serie: el('serie').value.trim(),
    set: el('set').value,
    ubicacion: el('ubicacion').value,
    fecha: el('fecha').value,
    obs: el('obs').value,
    foto: el('photoPreview').src || '',
    fotoPlaca: el('photoPlacaPreview').src || '',
    createdAt: new Date().toLocaleString()
  };
}

// === Render listado ===
async function renderSaved() {
  const wrap = el('savedList');
  const list = await getAllFromDB();
  wrap.innerHTML = '';

  if (!list.length) {
    wrap.innerHTML = '<li>No hay hojas guardadas</li>';
    return;
  }

  list.forEach(it => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'space-between';
    li.style.padding = '8px';
    li.style.marginBottom = '6px';
    li.style.background = 'rgba(255,255,255,0.05)';
    li.style.borderRadius = '6px';

    li.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" class="selectItem" value="${it.serie}" style="transform:scale(1.3);cursor:pointer;">
        <div>
          <strong>${it.serie}</strong><br>
          <small>${it.fecha || ''}</small>
        </div>
      </div>
    `;

    wrap.appendChild(li);
  });
}

// === Obtener seleccionadas ===
function getSelectedSeries() {
  return [...document.querySelectorAll('.selectItem:checked')].map(chk => chk.value);
}

// === PDF de seleccionadas ===
async function generateSelectedPDFs() {
  const selected = getSelectedSeries();
  if (!selected.length) return alert('Selecciona al menos una hoja.');
  const list = await getAllFromDB();
  const selectedData = list.filter(it => selected.includes(it.serie));

  for (const data of selectedData) {
    await generatePDF(data);
  }
}

// === Generar PDF individual ===
async function generatePDF(data) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  let y = 10;

  pdf.setFontSize(16);
  pdf.text('Levantamiento de Válvulas', 10, y);
  y += 10;
  pdf.setFontSize(12);

  const fields = [
    ['Cliente', data.cliente],
    ['Serie', data.serie],
    ['TAG', data.tag],
    ['Marca', data.marca],
    ['Modelo', data.modelo],
    ['Tamaño', data.tamano],
    ['Set de presión', data.set],
    ['Ubicación', data.ubicacion],
    ['Fecha', data.fecha],
    ['Observaciones', data.obs]
  ];

  fields.forEach(([label, value]) => {
    pdf.text(`${label}: ${value || ''}`, 10, y);
    y += 8;
  });

  if (data.foto) {
    try { pdf.addImage(data.foto, 'JPEG', 10, y, 85, 70); y += 80; } catch {}
  }
  if (data.fotoPlaca) {
    if (y > 240) { pdf.addPage(); y = 10; }
    try { pdf.addImage(data.fotoPlaca, 'JPEG', 10, y, 85, 70); y += 80; } catch {}
  }

  pdf.save(`Valvula_${data.serie}.pdf`);
}

// === Eliminar seleccionadas ===
async function deleteSelected() {
  const selected = getSelectedSeries();
  if (!selected.length) return alert('Selecciona al menos una hoja.');
  if (!confirm(`¿Eliminar ${selected.length} hoja(s)?`)) return;

  for (const serie of selected) {
    await new Promise(res => deleteFromDB(serie, res));
  }
  alert('🗑 Eliminadas correctamente');
  renderSaved();
}

// === Compartir seleccionadas ===
async function shareSelected() {
  const selected = getSelectedSeries();
  if (!selected.length) return alert('Selecciona al menos una hoja.');
  const list = await getAllFromDB();
  const selectedData = list.filter(it => selected.includes(it.serie));

  const files = [];
  for (const it of selectedData) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    let y = 10;

    pdf.setFontSize(16);
    pdf.text('Levantamiento de Válvulas', 10, y);
    y += 10;
    pdf.setFontSize(12);

    const fields = [
      ['Cliente', it.cliente],
      ['Serie', it.serie],
      ['TAG', it.tag],
      ['Marca', it.marca],
      ['Modelo', it.modelo],
      ['Tamaño', it.tamano],
      ['Set de presión', it.set],
      ['Ubicación', it.ubicacion],
      ['Fecha', it.fecha],
      ['Observaciones', it.obs]
    ];
    fields.forEach(([label, value]) => {
      pdf.text(`${label}: ${value || ''}`, 10, y);
      y += 8;
    });

    if (it.foto) try { pdf.addImage(it.foto, 'JPEG', 10, y, 85, 70); y += 80; } catch {}
    if (it.fotoPlaca) {
      if (y > 240) { pdf.addPage(); y = 10; }
      try { pdf.addImage(it.fotoPlaca, 'JPEG', 10, y, 85, 70); y += 80; } catch {}
    }

    const blob = pdf.output('blob');
    files.push(new File([blob], `Valvula_${it.serie}.pdf`, { type: 'application/pdf' }));
  }

  if (navigator.canShare && navigator.canShare({ files })) {
    await navigator.share({
      title: 'Hojas de vida seleccionadas',
      text: 'Adjunto registros seleccionados.',
      files
    });
  } else {
    alert('⚠️ El navegador no soporta compartir archivos.');
  }
}

// === Exportar fotos seleccionadas ===
async function exportSelectedPhotos() {
  const selected = getSelectedSeries();
  if (!selected.length) return alert('Selecciona al menos una hoja.');
  const list = await getAllFromDB();
  const selectedData = list.filter(it => selected.includes(it.serie));

  const zip = new JSZip();
  let count = 0;

  for (const it of selectedData) {
    if (it.foto) {
      zip.file(`Valvula_${it.serie}_valvula.jpg`, it.foto.split(",")[1], { base64: true });
      count++;
    }
    if (it.fotoPlaca) {
      zip.file(`Valvula_${it.serie}_placa.jpg`, it.fotoPlaca.split(",")[1], { base64: true });
      count++;
    }
  }

  if (!count) return alert("No hay fotos para exportar.");
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, "fotos_valvulas_seleccionadas.zip");
  alert(`📸 Se exportaron ${count} fotos.`);
}
