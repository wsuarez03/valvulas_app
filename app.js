// === Configuración ===
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
  const request = indexedDB.open(DB_NAME, 2); // versión 2 por cambio de keyPath
  request.onupgradeneeded = e => {
    const db = e.target.result;
    if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME);
    db.createObjectStore(STORE_NAME, { keyPath: 'serie' }); // clave única por serie
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
  const req = store.put(data); // put() permite actualizar si ya existe
  req.onsuccess = () => cb();
  req.onerror = e => console.error('Error al guardar:', e);
}

function getAllFromDB(cb) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).getAll();
  req.onsuccess = () => cb(req.result);
}

function deleteFromDB(serie, cb) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const req = store.delete(serie);
  req.onsuccess = () => cb();
  req.onerror = e => console.error('Error al eliminar:', e);
}

function compressImage(base64, maxWidth = 800, maxHeight = 800) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height && width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      } else if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8)); // calidad 80%
    };
    img.src = base64;
  });
}


// === Foto preview ===
function handlePhoto(e, previewId) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const compressed = await compressImage(ev.target.result);
    const img = document.getElementById(previewId);
    img.src = compressed;
    img.dataset.ready = "true";
  };
  reader.readAsDataURL(file);
}




// === Guardar local ===
function saveLocal() {
  const data = readFormData();
  if (!data.serie) return alert('⚠️ Debe ingresar la Serie (campo obligatorio)');

  const fotoListas = [...document.querySelectorAll('img[id$="Preview"]')]
    .every(img => !img.src || img.dataset.ready === "true");

  if (!fotoListas) {
    return alert('⏳ Espera a que se carguen completamente las fotos antes de guardar.');
  }

  addToDB(data, () => {
    alert('Guardado localmente ✅');
    renderSaved();
    document.getElementById('valveForm').reset();
    document.getElementById('photoPreview').src = '';
    document.getElementById('photoPlacaPreview').src = '';
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
          <button onclick='downloadSaved("${it.serie}")'>📄 PDF</button>
          <button onclick='deleteSaved("${it.serie}")' style="background:#ef4444;color:white">🗑</button>
        </div>
      `;
      wrap.appendChild(li);
    });
  });
}

// === Eliminar ===
function deleteSaved(serie) {
  if (!confirm('¿Eliminar esta hoja de vida local?')) return;
  deleteFromDB(serie, renderSaved);
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

  y += 4;

  if (data.foto) {
    try {
      pdf.text('Foto de la válvula:', 10, y);
      y += 6;
      pdf.addImage(data.foto, 'JPEG', 10, y, 85, 70);
      y += 80;
    } catch (e) {
      console.warn('Error añadiendo foto principal', e);
    }
  }

  if (data.fotoPlaca) {
    try {
      if (y > 240) { // crear nueva página si no cabe
        pdf.addPage();
        y = 10;
      }
      pdf.text('Foto de la placa:', 10, y);
      y += 6;
      pdf.addImage(data.fotoPlaca, 'JPEG', 10, y, 85, 70);
      y += 80;
    } catch (e) {
      console.warn('Error añadiendo foto de placa', e);
    }
  }

  pdf.save(`Valvula_${data.serie}.pdf`);
}

// === Descargar desde lista ===
function downloadSaved(serie) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(serie);
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
