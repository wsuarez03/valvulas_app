const DB_NAME = 'valvulasDB';
const STORE_NAME = 'hojas';
let db;

window.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  initDB();
  document.getElementById('photoInput').addEventListener('change', e => handlePhoto(e, 'photoPreview'));
  document.getElementById('photoPlacaInput').addEventListener('change', e => handlePhoto(e, 'photoPlacaPreview'));
  document.getElementById('saveBtn').addEventListener('click', saveLocal);
  document.getElementById('pdfBtn').addEventListener('click', generatePDFfromForm);
  document.getElementById('sendBtn').addEventListener('click', sendNow);
  document.getElementById('sendPendingBtn').addEventListener('click', sendPending);
}

// === IndexedDB ===
function initDB() {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = e => {
    const db = e.target.result;
    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
  };
  request.onsuccess = e => {
    db = e.target.result;
    renderSaved();
  };
  request.onerror = e => console.error('IndexedDB error:', e);
}

function addToDB(data, cb) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(data);
  tx.oncomplete = cb;
}

function getAllFromDB(cb) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).getAll();
  req.onsuccess = () => cb(req.result);
}

function deleteFromDB(id, cb) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  tx.oncomplete = cb;
}

// === Foto preview ===
function handlePhoto(e, previewId) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById(previewId).src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// === Guardar local ===
function saveLocal() {
  const data = readFormData();
  if (!data.serie) return alert('Debe ingresar la Serie (campo obligatorio)');
  addToDB(data, renderSaved);
  alert('Guardado localmente ✅');
  document.getElementById('valveForm').reset();
  document.getElementById('photoPreview').src = '';
  document.getElementById('photoPlacaPreview').src = '';
}

function readFormData() {
  return {
    cliente: el('cliente').value,
    tag: el('tag').value,
    marca: el('marca').value,
    modelo: el('modelo').value,
    tamano: el('tamano').value,
    serie: el('serie').value,
    set: el('set').value,
    ubicacion: el('ubicacion').value,
    fecha: el('fecha').value,
    obs: el('obs').value,
    foto: document.getElementById('photoPreview').src || '',
    fotoPlaca: document.getElementById('photoPlacaPreview').src || '',
    createdAt: new Date().toLocaleString()
  };
}

// === Render listado local ===
function renderSaved() {
  const wrap = el('savedList');
  wrap.innerHTML = '<li>Cargando...</li>';
  getAllFromDB(list => {
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.innerHTML = '<li>No hay hojas guardadas</li>';
      return;
    }
    list.forEach(it => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${it.serie}</strong> — ${it.ubicacion || 'Sin ubicación'}<br>
          <small>${it.fecha || ''} • ${it.createdAt || ''}</small>
        </div>
        <div>
          <button onclick='downloadSaved(${it.id})'>📄 PDF</button>
          <button onclick='deleteSaved(${it.id})' style="background:#ef4444;color:white">🗑</button>
        </div>
      `;
      wrap.appendChild(li);
    });
  });
}

// === Eliminar ===
function deleteSaved(id) {
  if (!confirm('¿Eliminar esta hoja de vida local?')) return;
  deleteFromDB(id, renderSaved);
}

// === PDF desde formulario ===
function generatePDFfromForm() {
  const data = readFormData();
  if (!data.serie) return alert('Debe ingresar la Serie antes de generar el PDF');
  generatePDF(data);
}

// === Generar PDF con ambas fotos ===
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

  // Espacio para fotos
  y += 4;
  if (data.foto) {
    try {
      pdf.text('Foto de la válvula:', 10, y);
      y += 6;
      pdf.addImage(data.foto, 'JPEG', 10, y, 90, 70);
      y += 80;
    } catch (e) {
      console.warn('Error añadiendo foto principal', e);
    }
  }

  if (data.fotoPlaca) {
    try {
      pdf.text('Foto de la placa:', 10, y);
      y += 6;
      pdf.addImage(data.fotoPlaca, 'JPEG', 10, y, 90, 70);
      y += 80;
    } catch (e) {
      console.warn('Error añadiendo foto de placa', e);
    }
  }

  pdf.save(`Valvula_${data.serie}.pdf`);
}

// === Descargar desde lista ===
function downloadSaved(id) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(id);
  req.onsuccess = () => {
    const data = req.result;
    if (data) generatePDF(data);
  };
}

// === Enviar ===
function sendNow() {
  const data = readFormData();
  if (!data.serie) return alert('Debe ingresar la Serie antes de enviar');
  if (!window.emailjs) return alert('EmailJS no está disponible');
  emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
    to_email: 'tecnicodeservicios@valserindustriales.com',
    subject: `Hoja de vida válvula ${data.serie}`,
    message: JSON.stringify(data, null, 2)
  })
  .then(() => alert('Correo enviado ✅'))
  .catch(err => alert('Error al enviar: ' + err.text));
}

// === Envío pendientes (futuro) ===
function sendPending() {
  alert('Función de envío pendiente (se puede integrar luego).');
}

// === Utilidad ===
function el(id){return document.getElementById(id);}
