Levantamiento de Válvulas - Web App (PWA) - Instrucciones rápidas

Archivos principales:
- index.html
- app.js
- styles.css
- manifest.json
- service-worker.js

Qué hace:
- Permite tomar foto (input capture) y diligenciar datos de la válvula.
- Guarda registros localmente (localStorage).
- Genera PDF (jsPDF + html2canvas) y permite descarga inmediata.
- Encola envíos por EmailJS cuando no hay conexión; al recuperar conexión intenta enviar automáticamente.
- Puedes descargar las hojas de vida PDF desde la lista 'Hojas de vida guardadas'.

Pasos para configurar EmailJS:
1. Crea una cuenta en https://www.emailjs.com/
2. Crea un service (por ejemplo: service_gmail) y toma el SERVICE_ID.
3. Crea una template y anota el TEMPLATE_ID. Asegúrate que la plantilla acepte un attachment (base64).
4. En index.html reemplaza 'YOUR_EMAILJS_USER_ID' con tu user ID (public key).
5. En app.js reemplaza YOUR_EMAILJS_SERVICE_ID y YOUR_EMAILJS_TEMPLATE_ID con los valores reales.
6. Opcional: modifica defaultRecipient en app.js si quieres otro correo.

Notas sobre offline y envíos:
- La app es una PWA simple; el service worker cachea los archivos declarados.
- Las fotos y datos se guardan en localStorage (esto es simple pero efectivo). Si necesitas manejar muchas fotos grandes, recomiendo migrar a IndexedDB.
- Cuando no haya internet, los registros se encolan (pendientes). Al volver la conexión la app intentará enviar automáticamente.
- Para una integración más robusta (envío seguro, almacenamiento central) se puede añadir un backend (Node.js) y almacenamiento en S3/Drive/GitHub.

Export adicional:
- PDF es ideal para la 'Hoja de vida' (imprimible, estándar). Si quieres también exportar a Excel/CSV para análisis, se puede añadir esa opción (SheetJS).

Correo por defecto: tecnicodeservicios@valserindustriales.com
Nombre de PDF: Valvula_{codigo}.pdf

Listo: el ZIP contiene el proyecto. Sigue las instrucciones del README para configurar EmailJS.
