const DB_NAME = 'valvulasDB';
const STORE_NAME = 'hojas';
let db;

window.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  initDB();
  document.getElementById('photoInput').addEventListener('change', handlePhoto);
  document.getElementById('saveBtn').addEventListener('click', saveLocal);
  document.getElementById('pdfBtn').addEventListener('click', generatePDF);
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
  const store = tx.objectStore(STORE_NAME);
  store.add(data);
  tx.oncomplete = cb;
}

function getAllFromDB(cb) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();
  req.onsuccess = () => cb(req.result);
}

function deleteFromDB(id, cb) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  tx.oncomplete = cb;
}

// === Foto preview ===
function handlePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('photoPreview').src = ev.target.result;
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
          <button onclick='downloadSaved(${it.id})'>PDF</button>
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

// === PDF ===
async function downloadSaved(id) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.get(id);
  req.onsuccess = async () => {
    const it = req.result;
    if (!it) return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    pdf.setFontSize(14);
    pdf.text('Levantamiento de Válvulas', 10, 10);
    let y = 20;
    Object.entries(it).forEach(([k, v]) => {
      if (k !== 'foto' && k !== 'id') {
        pdf.text(`${k}: ${v || ''}`, 10, y);
        y += 8;
      }
    });
    if (it.foto) {
      try {
        pdf.addImage(it.foto, 'JPEG', 130, 20, 60, 60);
      } catch (e) {
        console.warn('Error al añadir imagen al PDF', e);
      }
    }
    const filename = `Valvula_${it.serie || 'sin_serie'}.pdf`;
    pdf.save(filename);
  };
}

// === Enviar ===
function sendNow() {
  const data = readFormData();
  if (!data.serie) return alert('Debe ingresar la Serie antes de enviar');
  if (!window.emailjs) return alert('EmailJS no está disponible');
  emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
    to_email: 'tecnicodeservicios@valserindustriales.com',
    message: JSON.stringify(data, null, 2)
  })
  .then(() => alert('Correo enviado ✅'))
  .catch(err => alert('Error al enviar: ' + err.text));
}

// === Enviar pendientes (para uso futuro) ===
function sendPending() {
  alert('Función de envío pendiente se puede integrar luego con sincronización.');
}

// === Utilidad ===
function el(id){return document.getElementById(id);}
