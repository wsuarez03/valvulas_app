// === Configuración ===
const DB_NAME = 'valvulasDB';
const STORE_NAME = 'hojas';
let db;

// === Iniciar ===
window.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  renderSaved();

  document.getElementById('pdfSelectedBtn').addEventListener('click', generateSelectedPDFs);
  document.getElementById('shareSelectedBtn').addEventListener('click', shareSelected);
  document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelected);
  document.getElementById('exportSelectedPhotosBtn').addEventListener('click', exportSelectedPhotos);
});

// === IndexedDB ===
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME);
      db.createObjectStore(STORE_NAME, { keyPath: 'serie' });
    };

    request.onsuccess = e => {
      db = e.target.result;
      resolve();
    };

    request.onerror = e => reject(e);
  });
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

function deleteFromDB(serie) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(serie);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e);
  });
}

// === Render ===
async function renderSaved() {
  const wrap = document.getElementById('savedList');
  const list = await getAllFromDB();
  wrap.innerHTML = '';

  if (!list.length) {
    wrap.innerHTML = '<li>No hay hojas guardadas</li>';
    return;
  }

  list.forEach(it => {
    const li = document.createElement('li');
    li.style = 'display:flex;align-items:center;gap:8px;margin:4px 0;';
    li.innerHTML = `
      <input type="checkbox" class="selectItem" value="${it.serie}">
      <div>
        <strong>${it.serie}</strong><br>
        <small>${it.fecha || ''}</small>
      </div>
    `;
    wrap.appendChild(li);
  });
}

// === Utilidad ===
function getSelectedSeries() {
  return [...document.querySelectorAll('.selectItem:checked')].map(chk => chk.value);
}

// === Generar PDFs seleccionados ===
async function generateSelectedPDFs() {
  const selected = getSelectedSeries();
  if (!selected.length) return alert('Selecciona al menos una hoja.');
  const all = await getAllFromDB();
  const dataSel = all.filter(it => selected.includes(it.serie));

  for (const data of dataSel) await generatePDF(data);
}

async function generatePDF(data) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  let y = 10;

  pdf.setFontSize(16);
  pdf.text('Levantamiento de Válvulas', 10, y);
  y += 10;

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

  pdf.setFontSize(12);
  fields.forEach(([k, v]) => {
    pdf.text(`${k}: ${v || ''}`, 10, y);
    y += 8;
  });

  if (data.foto) try { pdf.addImage(data.foto, 'JPEG', 10, y, 85, 70); y += 80; } catch {}
  if (data.fotoPlaca) try { pdf.addImage(data.fotoPlaca, 'JPEG', 110, 10, 85, 70); } catch {}

  pdf.save(`Valvula_${data.serie}.pdf`);
}

// === Eliminar seleccionadas ===
async function deleteSelected() {
  const selected = getSelectedSeries();
  if (!selected.length) return alert('Selecciona al menos una hoja.');
  if (!confirm(`¿Eliminar ${selected.length} hoja(s)?`)) return;

  for (const serie of selected) await deleteFromDB(serie);
  alert('🗑 Eliminadas correctamente.');
  renderSaved();
}

// === Compartir seleccionadas ===
async function shareSelected() {
  const selected = getSelectedSeries();
  if (!selected.length) return alert('Selecciona al menos una hoja.');
  const all = await getAllFromDB();
  const dataSel = all.filter(it => selected.includes(it.serie));

  const { jsPDF } = window.jspdf;
  const files = [];

  for (const d of dataSel) {
    const pdf = new jsPDF();
    let y = 10;
    pdf.setFontSize(14);
    pdf.text(`Hoja ${d.serie}`, 10, y);
    y += 10;
    pdf.text(`Cliente: ${d.cliente}`, 10, y);
    y += 10;
    if (d.foto) try { pdf.addImage(d.foto, 'JPEG', 10, y, 85, 70); y += 80; } catch {}
    const blob = pdf.output('blob');
    files.push(new File([blob], `Valvula_${d.serie}.pdf`, { type: 'application/pdf' }));
  }

  if (navigator.canShare && navigator.canShare({ files })) {
    await navigator.share({ title: 'Hojas de vida', text: 'Adjunto registros.', files });
  } else {
    alert('⚠️ El navegador no soporta compartir archivos.');
  }
}

// === Exportar fotos seleccionadas ===
async function exportSelectedPhotos() {
  const selected = getSelectedSeries();
  if (!selected.length) return alert('Selecciona al menos una hoja.');
  const all = await getAllFromDB();
  const dataSel = all.filter(it => selected.includes(it.serie));

  const zip = new JSZip();
  let count = 0;

  for (const d of dataSel) {
    if (d.foto) {
      zip.file(`${d.serie}_valvula.jpg`, d.foto.split(',')[1], { base64: true });
      count++;
    }
    if (d.fotoPlaca) {
      zip.file(`${d.serie}_placa.jpg`, d.fotoPlaca.split(',')[1], { base64: true });
      count++;
    }
  }

  if (!count) return alert('No hay fotos para exportar.');
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'fotos_valvulas.zip');
  alert(`📸 Se exportaron ${count} fotos.`);
}
