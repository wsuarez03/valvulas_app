// Basic offline-first valve recorder app
// Uses localStorage for simplicity and queues pending sends for EmailJS

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
photoInput.addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const dataUrl = await fileToDataUrl(f);
  photoPreview.src = dataUrl;
  photoPreview.style.display = 'block';
});

photoPlacaInput.addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const dataUrl = await fileToDataUrl(f);
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
    cliente: el('cliente').value || '',
    tag: el('tag').value || '',
    marca: el('marca').value || '',
    modelo: el('modelo').value || '',
    tamano: el('tamano').value || '',
    serie: el('serie').value || '',
    set: el('set').value || '',
    ubicacion: el('ubicacion').value || '',
    fecha: el('fecha').value || (new Date()).toISOString().slice(0, 10),
    obs: el('obs').value || '',
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

// --- BOTONES PRINCIPALES ---
el('saveBtn').addEventListener('click', () => {
  const entry = readForm();
  if (!entry.serie) {
    alert('Ingrese la serie de la válvula');
    return;
  }
  entry.createdAt = new Date().toISOString();
  saveLocal(entry);
  alert('Guardado localmente ✅');
});

el('pdfBtn').addEventListener('click', async () => {
  const entry = readForm();
  if (!entry.serie) {
    alert('Ingrese la serie de la válvula');
    return;
  }
  const pdfBlob = await generatePdfBlob(entry);
  downloadBlob(pdfBlob, `Valvula_${entry.serie}.pdf`);
});

el('sendBtn').addEventListener('click', async () => {
  const entry = readForm();
  if (!entry.serie) {
    alert('Ingrese la serie de la válvula');
    return;
  }
  entry.createdAt = new Date().toISOString();
  addPending(entry);
  try {
    await trySendPending();
  } catch (e) {
    console.warn('Encolado para envío', e);
    alert('Encolado para envío cuando haya internet');
  }
});

// --- LISTADO GUARDADOS ---
function renderSaved() {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED) || '[]');
  const wrap = el('savedList');
  wrap.innerHTML = '';
  list.forEach((it, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${it.serie}</strong> — ${it.marca} — ${it.ubicacion}
        <br><small>${it.fecha} ${it.createdAt ? '<span> • ' + it.createdAt + '</span>' : ''}</small>
      </div>
      <div style="margin-top: 4px;">
        <button onclick="downloadSaved('${encodeURIComponent(JSON.stringify(it))}')">📄 Descargar PDF</button>
        <button onclick="deleteSaved(${index})" style="background-color:#c0392b; color:white;">🗑️ Eliminar</button>
      </div>`;
    wrap.appendChild(li);
  });
}

function deleteSaved(index) {
  if (!confirm('¿Deseas eliminar este registro?')) return;
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED) || '[]');
  list.splice(index, 1);
  localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(list));
  renderSaved();
}

window.downloadSaved = async (jsonEnc) => {
  const it = JSON.parse(decodeURIComponent(jsonEnc));
  const pdf = await generatePdfBlob(it);
  downloadBlob(pdf, `Valvula_${it.serie}.pdf`);
};

// --- LISTADO PENDIENTES ---
function renderPending() {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING) || '[]');
  const wrap = el('pendingList');
  wrap.innerHTML = '';
  list.forEach((it, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div><strong>${it.serie}</strong> — ${it.marca} — ${it.ubicacion}</div>
      <div>
        <button onclick="removePending(${idx})">Eliminar</button>
      </div>`;
    wrap.appendChild(li);
  });
}

window.removePending = (index) => {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING) || '[]');
  list.splice(index, 1);
  localStorage.setItem(STORAGE_KEYS.PENDING, JSON.stringify(list));
  renderPending();
};

// --- ENVÍO PENDIENTES ---
el('sendPendingBtn').addEventListener('click', async () => {
  try {
    await trySendPending();
    alert('Intento de envío completado.');
  } catch (e) {
    alert('No se pudo enviar. Permanece en pendientes.');
  }
});

async function trySendPending() {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING) || '[]');
  if (!list.length) {
    alert('No hay pendientes');
    return;
  }
  for (const entry of [...list].reverse()) {
    try {
      await sendViaEmailJS(entry);
      const current = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING) || '[]');
      const idx = current.findIndex(i => i.createdAt === entry.createdAt && i.serie === entry.serie);
      if (idx >= 0) {
        current.splice(idx, 1);
        localStorage.setItem(STORAGE_KEYS.PENDING, JSON.stringify(current));
      }
    } catch (e) {
      console.error('Error enviando', e);
      throw e;
    }
  }
  renderPending();
}

// --- EMAILJS ---
async function sendViaEmailJS(entry) {
  const pdfBlob = await generatePdfBlob(entry);
  const base64 = await blobToBase64(pdfBlob);
  const templateParams = {
    to_email: defaultRecipient,
    to_name: 'Supervisor SST',
    subject: `Hoja de vida válvula: ${entry.serie}`,
    message: `Adjunto hoja de vida de la válvula ${entry.serie}`,
    attachment: base64
  };

  const serviceID = 'YOUR_EMAILJS_SERVICE_ID';
  const templateID = 'YOUR_EMAILJS_TEMPLATE_ID';
  return emailjs.send(serviceID, templateID, templateParams);
}

// --- GENERAR PDF ---
async function generatePdfBlob(entry) {
  const card = document.createElement('div');
  card.style.width = '800px';
  card.style.padding = '18px';
  card.style.background = '#ffffff';
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
    <p><strong>Observaciones:</strong><br/> ${entry.obs}</p>
    <h3>Foto de la válvula</h3>
    ${entry.foto ? `<div><img src="${entry.foto}" style="max-width:760px;border:1px solid #ccc"/></div>` : '<p>No disponible</p>'}
    <h3>Foto de la placa</h3>
    ${entry.fotoPlaca ? `<div><img src="${entry.fotoPlaca}" style="max-width:760px;border:1px solid #ccc"/></div>` : '<p>No disponible</p>'}
  `;

  document.body.appendChild(card);
  const canvas = await html2canvas(card, { scale: 1.5, useCORS: true });
  document.body.removeChild(card);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

// --- UTILIDADES ---
function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

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

// --- EVENTOS ---
window.addEventListener('online', () => {
  trySendPending().catch(() => console.log('No se pudo enviar automático'));
});

window.addEventListener('load', () => {
  renderSaved();
  renderPending();
});
