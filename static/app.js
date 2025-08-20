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

// Función para obtener el token de autenticación
function getAuthToken() {
  return localStorage.getItem('authToken');
}

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
      body: formData,
      headers: {
        'Authorization': getAuthToken()
      }
    })
    .then(res => {
      if (res.status === 401) {
        alert('Sesión expirada. Por favor inicia sesión de nuevo.');
        window.location.href = '/';
        return;
      }
      return res.json();
    })
    .then(data => {
      if (data) {
        alert('Libro agregado correctamente');
        // Solo agregar la tarjeta del nuevo libro, sin recargar toda la lista
        const libro = {
          title: data.title || fileLimpio.name,
          filename: fileLimpio.name,
          public_url: data.public_url
        };
        const ext = libro.filename.split('.').pop().toLowerCase();
        fetch(libro.public_url, {
          headers: {
            'Authorization': getAuthToken()
          }
        })
          .then(res => res.blob())
          .then(blob => {
            if (ext === 'pdf') {
              mostrarPortadaPDF(blob, libro);
            } else if (ext === 'epub') {
              mostrarPortadaEPUB(blob, libro);
            }
          });
      }
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
  fetch('/api/libros', {
    headers: {
      'Authorization': getAuthToken()
    }
  })
    .then(res => {
      if (res.status === 401) {
        alert('Sesión expirada. Por favor inicia sesión de nuevo.');
        window.location.href = '/';
        return [];
      }
      return res.json();
    })
    .then(libros => {
      library.innerHTML = '';
      if (!Array.isArray(libros) || libros.length === 0) {
        library.innerHTML = '<div class="col-span-4 text-center text-gray-500">No hay libros agregados aún.</div>';
        return;
      }
      libros.forEach(libro => {
        const ext = libro.filename.split('.').pop().toLowerCase();
        fetch(libro.public_url, {
          headers: {
            'Authorization': getAuthToken()
          }
        })
          .then(res => res.blob())
          .then(blob => {
            if (ext === 'pdf') {
              mostrarPortadaPDF(blob, libro);
            } else if (ext === 'epub') {
              mostrarPortadaEPUB(blob, libro);
            }
          });
      });
    });
}

// Extraer portada PDF (primera página)
function mostrarPortadaPDF(blob, libro) {
  const reader = new FileReader();
  reader.onload = () => {
    pdfjsLib.getDocument({ data: reader.result }).promise.then(pdfDoc => {
      pdfDoc.getPage(1).then(page => {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(() => {
          crearCard(canvas.toDataURL(), libro);
        });
      });
    });
  };
  reader.readAsArrayBuffer(blob);
}

// Extraer portada EPUB (imagen de portada)
function mostrarPortadaEPUB(blob, libro) {
  const reader = new FileReader();
  reader.onload = () => {
    const book = ePub(reader.result);
    book.loaded.cover.then(coverUrl => {
      if (coverUrl) {
        book.archive.createUrl(coverUrl).then(url => {
          crearCard(url, libro);
        });
      } else {
        crearCard('static/default_cover.png', libro); // Imagen por defecto
      }
    });
  };
  reader.readAsArrayBuffer(blob);
}

// Crear tarjeta visual
function crearCard(imgSrc, libro) {
  // Limpia el nombre: quita extensión, guiones, números, puntos y reemplaza por espacios
  let titulo = libro.title || libro.filename;
  titulo = titulo.replace(/\.[^/.]+$/, ''); // Quita la extensión
  titulo = titulo.replace(/[_\-\.]+/g, ' ');  // Quita guiones, guiones bajos y puntos
  titulo = titulo.replace(/\d+/g, '');        // Quita números
  titulo = titulo.replace(/\s{2,}/g, ' ').trim(); // Limpia espacios extra

  const card = document.createElement('div');
  card.className = 'card flex flex-col items-center p-2 cursor-pointer';
  card.innerHTML = `
    <img src="${imgSrc}" alt="Portada" class="rounded-lg mb-2 object-cover" style="width:120px;height:170px;">
    <div class='font-semibold text-center w-full'>${titulo}</div>
  `;
  card.addEventListener('click', () => {
    const ext = libro.filename.split('.').pop().toLowerCase();
    fetch(libro.public_url, {
      headers: {
        'Authorization': getAuthToken()
      }
    })
      .then(res => {
        if (res.status === 401) {
          alert('Sesión expirada. Por favor inicia sesión de nuevo.');
          window.location.href = '/';
          return;
        }
        return res.blob();
      })
      .then(blob => {
        if (blob) openReader(blob, ext);
      });
  });
  library.appendChild(card);
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

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('authToken');
  window.location.href = '/';
});

if (!localStorage.getItem('authToken')) {
  window.location.href = '/';
}

if (window['pdfjsLib']) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
}