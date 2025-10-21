let db;

function initDB() {
  const req = indexedDB.open("valvulasDB", 1);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("valvulas")) {
      db.createObjectStore("valvulas", { keyPath: "id", autoIncrement: true });
    }
  };
  req.onsuccess = e => {
    db = e.target.result;
    renderSaved();
  };
}

function saveValve(data) {
  const tx = db.transaction("valvulas", "readwrite");
  tx.objectStore("valvulas").add(data);
  tx.oncomplete = renderSaved;
}

function renderSaved() {
  const list = document.getElementById("savedList");
  list.innerHTML = "";
  const tx = db.transaction("valvulas", "readonly");
  const store = tx.objectStore("valvulas");
  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const it = cursor.value;
      const li = document.createElement("li");
      li.innerHTML = `
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" class="selectItem" data-id="${it.id}">
          <strong>válvula_${it.serie}</strong><br>
          <small>${it.fecha || ""}</small>
        </label>`;
      list.appendChild(li);
      cursor.continue();
    }
  };
}

function getSelectedIDs() {
  return [...document.querySelectorAll(".selectItem:checked")].map(cb => parseInt(cb.dataset.id));
}

function deleteSelected() {
  const ids = getSelectedIDs();
  if (!ids.length) return alert("Selecciona al menos una hoja.");
  const tx = db.transaction("valvulas", "readwrite");
  const store = tx.objectStore("valvulas");
  ids.forEach(id => store.delete(id));
  tx.oncomplete = renderSaved;
}

function exportFotosSelected() {
  const ids = getSelectedIDs();
  if (!ids.length) return alert("Selecciona hojas para exportar.");
  const tx = db.transaction("valvulas", "readonly");
  const store = tx.objectStore("valvulas");
  const zipImages = [];
  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      if (ids.includes(cursor.value.id)) {
        if (cursor.value.foto) zipImages.push(cursor.value.foto);
        if (cursor.value.fotoPlaca) zipImages.push(cursor.value.fotoPlaca);
      }
      cursor.continue();
    } else {
      alert(`Se encontraron ${zipImages.length} fotos seleccionadas.`);
    }
  };
}

function shareSelected() {
  const ids = getSelectedIDs();
  if (!ids.length) return alert("Selecciona hojas para compartir.");
  alert(`Compartiría ${ids.length} hojas (puede implementarse envío por correo o PDF).`);
}

document.getElementById("saveBtn")?.addEventListener("click", () => {
  const serie = document.getElementById("serie").value.trim();
  if (!serie) return alert("El campo Serie es obligatorio.");
  const data = {
    serie,
    cliente: document.getElementById("cliente").value,
    tag: document.getElementById("tag").value,
    marca: document.getElementById("marca").value,
    modelo: document.getElementById("modelo").value,
    tamano: document.getElementById("tamano").value,
    set: document.getElementById("set").value,
    ubicacion: document.getElementById("ubicacion").value,
    fecha: document.getElementById("fecha").value,
    obs: document.getElementById("obs").value,
    created: new Date().toLocaleString(),
  };
  saveValve(data);
  alert("Hoja guardada localmente.");
});

document.getElementById("deleteSelected")?.addEventListener("click", deleteSelected);
document.getElementById("exportSelected")?.addEventListener("click", exportFotosSelected);
document.getElementById("shareSelected")?.addEventListener("click", shareSelected);

initDB();
