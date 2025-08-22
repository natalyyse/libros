const fileInput = document.getElementById('fileInput');
const loader = document.getElementById('loader');
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
  loader.classList.remove('hidden'); // Mostrar loader al iniciar subida
  let promesas = Array.from(e.target.files).map((file) => {
    return new Promise((resolve) => {
      let nombreLimpio = file.name.replace(simbolosInvalidos, '').trim();
      if (!nombreLimpio) {
        alert(`El archivo "${file.name}" no tiene un nombre válido después de limpiar los símbolos y no será subido.`);
        return resolve();
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
          loader.classList.add('hidden');
          alert('Sesión expirada. Por favor inicia sesión de nuevo.');
          window.location.href = '/';
          return resolve();
        }
        return res.json();
      })
      .then(data => {
        resolve(data); // Solo resuelve, no oculta loader ni muestra alerta aquí
      })
      .catch(err => {
        resolve(null); // Solo resuelve, no oculta loader ni muestra alerta aquí
      });
    });
  });

  Promise.all(promesas).then((resultados) => {
    // Solo muestra la alerta si al menos un libro se subió correctamente
    if (resultados.some(r => r)) {
      alert('Libros agregados correctamente');
    } else {
      alert('No se pudo agregar ningún libro');
    }
    mostrarLibros(); // Esto ya maneja el loader y lo oculta cuando termina de mostrar todos los libros
    fileInput.value = '';
  });
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
      loader.classList.add('hidden');
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
    pdfCanvas.classList.remove('hidden'); // <-- Muestra el canvas para PDF
    const reader = new FileReader();
    reader.onload = () => {
      pdfjsLib.getDocument({ data: reader.result }).promise.then(doc => {
        loader.classList.add('hidden');
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
  loader.classList.remove('hidden'); // Mostrar loader al cargar libros
  fetch('/api/libros', {
    headers: {
      'Authorization': getAuthToken()
    }
  })
    .then(res => {
      if (res.status === 401) {
        loader.classList.add('hidden');
        alert('Sesión expirada. Por favor inicia sesión de nuevo.');
        window.location.href = '/';
        return [];
      }
      return res.json();
    })
    .then(libros => {
      library.innerHTML = '';
      if (!Array.isArray(libros) || libros.length === 0) {
        library.innerHTML = '<div id="noLibrosMsg" class="col-span-4 text-center text-gray-500">No hay libros agregados aún.</div>';
        loader.classList.add('hidden');
        return;
      }
      const noLibrosMsg = document.getElementById('noLibrosMsg');
      if (noLibrosMsg) noLibrosMsg.remove();
      let portadasPromises = libros.map(libro => {
        const ext = libro.filename.split('.').pop().toLowerCase();
        return fetch(libro.public_url, {
          headers: {
            'Authorization': getAuthToken()
          }
        })
          .then(res => res.blob())
          .then(blob => {
            if (ext === 'pdf') {
              return new Promise(resolve => {
                mostrarPortadaPDF(blob, libro, resolve);
              });
            } else if (ext === 'epub') {
              return new Promise(resolve => {
                mostrarPortadaEPUB(blob, libro, resolve);
              });
            }
          });
      });
      Promise.all(portadasPromises).then(() => {
        loader.classList.add('hidden'); // Oculta loader cuando termina de mostrar todos los libros
      });
    });
}

// Extraer portada PDF (primera página)
function mostrarPortadaPDF(blob, libro, resolve) {
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
          resolve();
        });
      });
    });
  };
  reader.readAsArrayBuffer(blob);
}

// Extraer portada EPUB (imagen de portada)
function mostrarPortadaEPUB(blob, libro, resolve) {
  const reader = new FileReader();
  reader.onload = () => {
    const book = ePub(reader.result);
    book.loaded.cover.then(coverUrl => {
      if (coverUrl) {
        book.archive.createUrl(coverUrl).then(url => {
          crearCard(url, libro);
          resolve();
        });
      } else {
        crearCard('static/default_cover.png', libro); // Imagen por defecto
        resolve();
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
    loader.classList.remove('hidden'); // Mostrar loader al abrir libro
    const ext = libro.filename.split('.').pop().toLowerCase();
    fetch(libro.public_url, {
      headers: {
        'Authorization': getAuthToken()
      }
    })
      .then(res => {
        if (res.status === 401) {
          loader.classList.add('hidden');
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

// Crear modal para borrar libros
function crearModalBorrar(libros) {
  // Si ya existe, elimínalo
  let modal = document.getElementById('deleteModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'deleteModal';
  modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
      <h2 class="text-lg font-bold mb-4">Selecciona los libros a borrar</h2>
      <form id="deleteForm">
        <div class="max-h-60 overflow-y-auto mb-4">
          ${libros.map(libro => `
            <label class="flex items-center mb-2">
              <input type="checkbox" name="libros" value="${libro.filename}" class="mr-2">
              <span>${libro.title || libro.filename}</span>
            </label>
          `).join('')}
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" id="cancelDelete" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
          <button type="submit" class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Borrar seleccionados</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('cancelDelete').onclick = () => modal.remove();

  document.getElementById('deleteForm').onsubmit = function(e) {
    e.preventDefault();
    const seleccionados = Array.from(this.libros)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    if (seleccionados.length === 0) {
      alert('Selecciona al menos un libro.');
      return;
    }
    loader.classList.remove('hidden');
    fetch('/api/libros/borrar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthToken()
      },
      body: JSON.stringify({ filenames: seleccionados })
    })
    .then(res => {
      loader.classList.add('hidden');
      modal.remove();
      if (res.status === 401) {
        alert('Sesión expirada. Por favor inicia sesión de nuevo.');
        window.location.href = '/';
        return;
      }
      if (!res.ok) {
        alert('Error al borrar libros');
        return;
      }
      alert('Libros borrados correctamente');
      mostrarLibros();
    });
  };
}

// Acción del tachito
document.getElementById('trashBtn').addEventListener('click', () => {
  loader.classList.remove('hidden');
  fetch('/api/libros', {
    headers: { 'Authorization': getAuthToken() }
  })
  .then(res => res.json())
  .then(libros => {
    loader.classList.add('hidden');
    crearModalBorrar(libros);
  });
});

// Inicialización al cargar la página
window.addEventListener('DOMContentLoaded', () => {
  loader.classList.remove('hidden'); // Mostrar loader al cargar la página
  mostrarLibros();
});

// Redimensiona el lector EPUB al cambiar el tamaño de la ventana
window.addEventListener('resize', () => {
  if (epubRendition && epubContainer) {
    const contentBox = epubContainer.getBoundingClientRect();
    epubRendition.resize(contentBox.width, contentBox.height);
  }
});

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('username');
  window.location.href = '/';
});

if (!localStorage.getItem('authToken')) {
  window.location.href = '/';
}

if (window['pdfjsLib']) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
}

