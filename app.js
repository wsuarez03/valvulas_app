const STORAGE_KEYS = {
  SAVED: 'valvulas_saved_v1',
  PENDING: 'valvulas_pending_v1'
};

const defaultRecipient = 'tecnicodeservicios@valserindustriales.com';
const el = id => document.getElementById(id);

const photoInput = el('photoInput');
const photoPreview = el('photoPreview');
const photoPlacaInput = el('photoPlacaInput');
const photoPlacaPreview = el('photoPlacaPreview');
const form = el('valveForm');

// --- CARGA DE FOTOS ---
photoInput.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  photoPreview.src = dataUrl;
  photoPreview.style.display = 'block';
});

photoPlacaInput.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  photoPlacaPreview.src = dataUrl;
  photoPlacaPreview.style.display = 'block';
});

async function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// --- LECTURA Y GUARDADO ---
function readForm() {
  return {
    cliente: el('cliente').value,
    tag: el('tag').value,
    marca: el('marca').value,
    modelo: el('modelo').value,
    tamano: el('tamano').value,
    serie: el('serie').value,
    set: el('set').value,
    ubicacion: el('ubicacion').value,
    fecha: el('fecha').value || new Date().toISOString().slice(0, 10),
    obs: el('obs').value,
    foto: photoPreview.src || '',
    fotoPlaca: photoPlacaPreview.src || ''
  };
}

function saveLocal(entry) {
  const items = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED) || '[]');
  items.unshift(entry);
  localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(items));
  renderSaved();
}

function addPending(entry) {
  const items = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING) || '[]');
  items.unshift(entry);
  localStorage.setItem(STORAGE_KEYS.PENDING, JSON.stringify(items));
  renderPending();
}

// --- BOTONES ---
el('saveBtn').addEventListener('click', () => {
  const entry = readForm();
  if (!entry.serie) return alert('Ingrese la serie de la válvula');
  entry.createdAt = new Date().toISOString();
  saveLocal(entry);
  alert('Guardado localmente ✅');
});

el('pdfBtn').addEventListener('click', async () => {
  const entry = readForm();
  if (!entry.serie) return alert('Ingrese la serie de la válvula');
  const pdfBlob = await generatePdfBlob(entry);
  downloadBlob(pdfBlob, `Valvula_${entry.serie}.pdf`);
});

el('sendBtn').addEventListener('click', async () => {
  const entry = readForm();
  if (!entry.serie) return alert('Ingrese la serie de la válvula');
  entry.createdAt = new Date().toISOString();
  addPending(entry);
  try {
    await trySendPending();
  } catch {
    alert('Encolado para envío cuando haya internet');
  }
});

// --- LISTADOS ---
function renderSaved() {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED) || '[]');
  const wrap = el('savedList');
  wrap.innerHTML = '';
  list.forEach((it, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div><strong>${it.serie}</strong> — ${it.marca} — ${it.ubicacion}<br><small>${it.fecha}</small></div>
      <div>
        <button onclick="downloadSaved('${encodeURIComponent(JSON.stringify(it))}')">📄 PDF</button>
        <button onclick="deleteSaved(${i})" style="background:#c0392b;color:white;">🗑️</button>
      </div>`;
    wrap.appendChild(li);
  });
}

function deleteSaved(i) {
  if (!confirm('¿Eliminar este registro?')) return;
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED) || '[]');
  list.splice(i, 1);
  localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(list));
  renderSaved();
}

window.downloadSaved = async (jsonEnc) => {
  const it = JSON.parse(decodeURIComponent(jsonEnc));
  const pdf = await generatePdfBlob(it);
  downloadBlob(pdf, `Valvula_${it.serie}.pdf`);
};

// --- PDF ---
async function generatePdfBlob(entry) {
  const card = document.createElement('div');
  card.style.width = '800px';
  card.style.padding = '18px';
  card.style.background = '#fff';
  card.style.color = '#000';
  card.innerHTML = `
    <h2>Válvula - Hoja de Vida</h2>
    <p><strong>Cliente:</strong> ${entry.cliente}</p>
    <p><strong>Serie:</strong> ${entry.serie}</p>
    <p><strong>TAG:</strong> ${entry.tag}</p>
    <p><strong>Marca:</strong> ${entry.marca}</p>
    <p><strong>Modelo:</strong> ${entry.modelo}</p>
    <p><strong>Tamaño:</strong> ${entry.tamano}</p>
    <p><strong>Set de presión:</strong> ${entry.set}</p>
    <p><strong>Ubicación:</strong> ${entry.ubicacion}</p>
    <p><strong>Fecha:</strong> ${entry.fecha}</p>
    <p><strong>Observaciones:</strong><br>${entry.obs}</p>
    <h3>Foto válvula</h3>
    ${entry.foto ? `<img src="${entry.foto}" style="max-width:760px;border:1px solid #ccc">` : '<p>No disponible</p>'}
    <h3>Foto placa</h3>
    ${entry.fotoPlaca ? `<img src="${entry.fotoPlaca}" style="max-width:760px;border:1px solid #ccc">` : '<p>No disponible</p>'}
  `;
  document.body.appendChild(card);
  const canvas = await html2canvas(card, { scale: 1.5, useCORS: true });
  document.body.removeChild(card);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

// --- UTILS ---
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

window.addEventListener('load', () => {
  renderSaved();
});
