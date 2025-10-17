const DB_NAME = 'valvulasDB';
const STORE_NAME = 'valvulas';
let db;

window.onload = () => {
  initDB();
  document.getElementById('photoInput').addEventListener('change', previewPhoto);
  document.getElementById('saveBtn').addEventListener('click', saveData);
  renderSaved();
};

function initDB() {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    renderSaved();
  };
  request.onerror = (e) => console.error('Error al abrir IndexedDB', e);
}

function previewPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => document.getElementById('photoPreview').src = reader.result;
  reader.readAsDataURL(file);
}

function saveData() {
  const form = {
    cliente: document.getElementById('cliente').value,
    tag: document.getElementById('tag').value,
    marca: document.getElementById('marca').value,
    modelo: document.getElementById('modelo').value,
    tamano: document.getElementById('tamano').value,
    serie: document.getElementById('serie').value,
    set: document.getElementById('set').value,
    ubicacion: document.getElementById('ubicacion').value,
    fecha: document.getElementById('fecha').value,
    obs: document.getElementById('obs').value,
    foto: document.getElementById('photoPreview').src || null,
    createdAt: new Date().toLocaleString()
  };

  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(form);
  tx.oncomplete = () => renderSaved();
}

function renderSaved() {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).getAll();
  req.onsuccess = () => {
    const list = req.result;
    const wrap = document.getElementById('savedList');
    wrap.innerHTML = '';
    list.forEach(it => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${it.tag}</strong> — ${it.cliente}
          <br><small>${it.fecha} • ${it.createdAt}</small>
        </div>
        <div>
          <button onclick='downloadSaved(${it.id})'>Descargar PDF</button>
          <button onclick='deleteSaved(${it.id})' class='danger'>Eliminar</button>
        </div>`;
      wrap.appendChild(li);
    });
  };
}

function deleteSaved(id) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  tx.oncomplete = () => renderSaved();
}

async function downloadSaved(id) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(id);
  req.onsuccess = async () => {
    const data = req.result;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Hoja de Vida - Válvula", 10, 10);
    doc.text(`Cliente: ${data.cliente}`, 10, 20);
    doc.text(`Tag: ${data.tag}`, 10, 30);
    doc.text(`Marca: ${data.marca}`, 10, 40);
    doc.text(`Modelo: ${data.modelo}`, 10, 50);
    doc.text(`Tamaño: ${data.tamano}`, 10, 60);
    doc.text(`Serie: ${data.serie}`, 10, 70);
    doc.text(`Set: ${data.set}`, 10, 80);
    doc.text(`Ubicación: ${data.ubicacion}`, 10, 90);
    doc.text(`Fecha: ${data.fecha}`, 10, 100);
    doc.text(`Obs: ${data.obs}`, 10, 110);

    if (data.foto) {
      const img = new Image();
      img.src = data.foto;
      await img.decode();
      doc.addImage(img, 'JPEG', 130, 20, 60, 60);
    }

    doc.save(`valvula_${data.tag}.pdf`);
  };
}
