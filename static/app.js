const fileInput = document.getElementById('fileInput');
const library = document.getElementById('library');
const modal = document.getElementById('readerModal');
const closeBtn = document.getElementById('closeBtn');
const epubContainer = document.getElementById('epub-reader');
const epubReaderContainer = document.getElementById('epub-reader-container');
const pdfCanvas = document.getElementById('pdf-canvas');
const pdfReaderContainer = document.getElementById('pdf-reader-container');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfo = document.getElementById('pageInfo');

let epubRendition, pdfDoc = null, currentPage = 1;
const simbolosInvalidos = /[\/\\:\*\?"<>\|\%\#]/g;

// Subida de archivos y limpieza de nombres
fileInput.addEventListener('change', (e) => {
  Array.from(e.target.files).forEach((file) => {
    let nombreLimpio = file.name.replace(simbolosInvalidos, '').trim();
    if (!nombreLimpio) {
      alert(`El archivo "${file.name}" no tiene un nombre válido después de limpiar los símbolos y no será subido.`);
      return;
    }
    const fileLimpio = new File([file], nombreLimpio, { type: file.type });
    const formData = new FormData();
    formData.append('file', fileLimpio);
    formData.append('title', nombreLimpio);

    fetch('/api/libros', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      alert('Libro agregado correctamente');
      mostrarLibros();
    })
    .catch(err => {
      alert('Error al agregar libro');
    });
  });
  fileInput.value = '';
});

// Eventos de navegación y cierre del modal
closeBtn.addEventListener('click', () => { modal.style.display = 'none'; cleanup(); });
prevBtn.addEventListener('click', () => navigate(-1));
nextBtn.addEventListener('click', () => navigate(1));

// Abrir lector EPUB o PDF
function openReader(file, ext) {
  modal.style.display = 'flex';
  if (ext === 'epub') {
    epubReaderContainer.style.display = 'flex';
    pdfReaderContainer.style.display = 'none';
    pdfCanvas.classList.add('hidden');
    epubContainer.classList.remove('hidden');
    epubContainer.style.height = '70vh';
    epubContainer.style.width = '100%';
    if (epubRendition) epubRendition.destroy();
    const book = ePub(file);
    epubRendition = book.renderTo(epubContainer, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      manager: 'default'
    });
    epubRendition.themes.default({
      body: { margin: '1rem auto', 'font-size': '100%', 'max-width': '700px' }
    });
    epubRendition.display();

    epubRendition.on('rendered', async (section) => {
      const location = epubRendition.location;
      if (location && location.start && location.start.displayed) {
        const current = location.start.displayed.page;
        const total = location.start.displayed.total;
        pageInfo.textContent = `Página ${current} de ${total}`;
      } else {
        pageInfo.textContent = '';
      }
    });
  } else if (ext === 'pdf') {
    epubReaderContainer.style.display = 'none';
    pdfReaderContainer.style.display = 'flex';
    epubContainer.classList.add('hidden');
    pdfCanvas.classList.remove('hidden');
    const reader = new FileReader();
    reader.onload = () => {
      pdfjsLib.getDocument({ data: reader.result }).promise.then(doc => {
        pdfDoc = doc; currentPage = 1; renderPage(currentPage);
      });
    };
    reader.readAsArrayBuffer(file);
  }
}

// Renderizar página PDF
function renderPage(num) {
  pdfDoc.getPage(num).then(page => {
    const viewport = page.getViewport({ scale: 1 });
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;
    const ctx = pdfCanvas.getContext('2d');
    page.render({ canvasContext: ctx, viewport: viewport });
    pageInfo.textContent = `Página ${num} de ${pdfDoc.numPages}`;
  });
}

// Navegación entre páginas EPUB/PDF
function navigate(offset) {
  if (epubRendition) {
    offset > 0 ? epubRendition.next() : epubRendition.prev();
  } else if (pdfDoc) {
    const newPage = currentPage + offset;
    if (newPage > 0 && newPage <= pdfDoc.numPages) {
      currentPage = newPage; renderPage(currentPage);
    }
  }
}

// Limpieza al cerrar el modal
function cleanup() {
  if (epubRendition) epubRendition.destroy();
  epubRendition = null;
  pdfDoc = null;
  epubReaderContainer.style.display = 'none';
  pdfReaderContainer.style.display = 'none';
  epubContainer.classList.add('hidden');
  pdfCanvas.classList.add('hidden');
}

// Mostrar libros en la biblioteca
function mostrarLibros() {
  fetch('/api/libros')
    .then(res => res.json())
    .then(libros => {
      library.innerHTML = '';
      libros.forEach(libro => {
        const ext = libro.filename.split('.').pop().toLowerCase();
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded shadow cursor-pointer hover:shadow-md';
        card.innerHTML = `<div class='font-semibold truncate'>${libro.title}</div>`;
        card.addEventListener('click', () => {
          if (ext === 'epub' || ext === 'pdf') {
            fetch(libro.public_url)
              .then(res => res.blob())
              .then(blob => openReader(blob, ext));
          }
        });
        library.appendChild(card);
      });
    });
}

// Inicialización al cargar la página
window.addEventListener('DOMContentLoaded', mostrarLibros);

// Redimensiona el lector EPUB al cambiar el tamaño de la ventana
window.addEventListener('resize', () => {
  if (epubRendition && epubContainer) {
    const contentBox = epubContainer.getBoundingClientRect();
    epubRendition.resize(contentBox.width, contentBox.height);
  }
});