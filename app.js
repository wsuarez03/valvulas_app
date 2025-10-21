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
          <strong>${it.serie}</strong> <br>
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

  // --- Pausa para garantizar que las imágenes se carguen ---
  const ensureImage = base64 => new Promise(resolve => {
    if (!base64) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = base64;
  });

  const fotoValve = await ensureImage(data.foto);
  const fotoPlaca = await ensureImage(data.fotoPlaca);

  y += 4;

  if (fotoValve) {
    pdf.text('Foto de la válvula:', 10, y);
    y += 6;
    pdf.addImage(fotoValve, 'JPEG', 10, y, 85, 70);
    y += 80;
  }

  if (fotoPlaca) {
    if (y > 240) { // crear nueva página si no cabe
      pdf.addPage();
      y = 10;
    }
    pdf.text('Foto de la placa:', 10, y);
    y += 6;
    pdf.addImage(fotoPlaca, 'JPEG', 10, y, 85, 70);
    y += 80;
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

// === Envío pendientes (futuro) ===
function sendPending() {
  alert('Función de envío pendiente (se puede integrar luego).');
}

// === Utilidad ===
function el(id){return document.getElementById(id);}

async function shareAllPdfs() {
  getAllFromDB(async (list) => {
    if (!list.length) return alert('No hay hojas guardadas para compartir.');

    const files = [];
    for (const it of list) {
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

      if (it.foto) {
        try { pdf.addImage(it.foto, 'JPEG', 10, y, 85, 70); y += 80; } catch {}
      }
      if (it.fotoPlaca) {
        if (y > 240) { pdf.addPage(); y = 10; }
        try { pdf.addImage(it.fotoPlaca, 'JPEG', 10, y, 85, 70); y += 80; } catch {}
      }

      const blob = pdf.output('blob');
      files.push(new File([blob], `Valvula_${it.serie}.pdf`, { type: 'application/pdf' }));
    }

    // Verificar soporte del navegador
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({
          title: 'Hojas de vida de válvulas',
          text: 'Adjunto los registros generados desde la app.',
          files
        });
        alert('📤 Archivos compartidos correctamente.');
      } catch (err) {
        console.error('Error al compartir:', err);
        alert('❌ No se pudo compartir.');
      }
    } else {
      alert('⚠️ El navegador no soporta compartir archivos directamente.');
    }
  });
}

// Asignar evento al botón (cuando el DOM esté listo)
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('shareAllBtn');
  if (btn) btn.addEventListener('click', shareAllPdfs);
});


// === Exportar fotos guardadas ===
function exportarFotos() {
  getAllFromDB(list => {
    if (!list.length) {
      alert('⚠️ No hay hojas guardadas con fotos.');
      return;
    }

    let contador = 0;

    list.forEach(item => {
      if (item.foto) {
        const link1 = document.createElement('a');
        link1.href = item.foto;
        link1.download = `Valvula_${item.serie}_valvula.jpg`;
        document.body.appendChild(link1);
        link1.click();
        link1.remove();
        contador++;
      }
      if (item.fotoPlaca) {
        const link2 = document.createElement('a');
        link2.href = item.fotoPlaca;
        link2.download = `Valvula_${item.serie}_placa.jpg`;
        document.body.appendChild(link2);
        link2.click();
        link2.remove();
        contador++;
      }
    });

    if (contador === 0) {
      alert('⚠️ No se encontraron fotos en los registros guardados.');
    } else {
      alert(`✅ ${contador} fotos exportadas correctamente.`);
    }
  });
}

