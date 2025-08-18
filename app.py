from flask import Flask, request, jsonify, send_file, send_from_directory
from supabase import create_client
import io

# --- Configuración de Supabase ---
# Se conecta a la base de datos Supabase usando la URL y la clave de API.
url = "https://whrvxjjqldtpgfahcgth.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocnZ4ampxbGR0cGdmYWhjZ3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NTA4NjIsImV4cCI6MjA3MDAyNjg2Mn0.QrjRXRzaOxKMzvhfsv9dcQSNGv2hIeM6Mfeui0ob48Q"
supabase = create_client(url, key)

# --- Inicialización de la aplicación Flask ---
app = Flask(__name__)

# --- Endpoint para agregar un libro ---
@app.route('/api/libros', methods=['POST'])
def agregar_libro():
    """
    Recibe un archivo (EPUB o PDF) y lo guarda en la base de datos Supabase.
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió archivo'}), 400
        file = request.files['file']
        filename = file.filename
        title = request.form.get('title', filename)
        file_bytes = file.read()
        mime_type = file.mimetype

        public_url = f'/api/libros/{filename}'

        # Guarda los datos del libro en la tabla "books"
        data = {
            "title": title,
            "filename": filename,
            "mime_type": mime_type,
            "public_url": public_url,
            "file_data": file_bytes.hex()
        }
        supabase.table("books").insert(data).execute()

        return jsonify({'message': 'Libro agregado correctamente', 'public_url': public_url}), 201
    except Exception as e:
        print("ERROR:", e)
        return jsonify({'error': str(e)}), 500

# --- Endpoint para obtener la lista de libros ---
@app.route('/api/libros', methods=['GET'])
def obtener_libros():
    """
    Devuelve una lista de los libros guardados (título y nombre de archivo).
    """
    res = supabase.table("books").select("title,filename").execute()
    libros = res.data
    for libro in libros:
        libro['public_url'] = f'/api/libros/{libro["filename"]}'
    return jsonify(libros)

# --- Endpoint para mostrar (descargar/leer) un libro específico ---
@app.route('/api/libros/<filename>', methods=['GET'])
def mostrar_libro(filename):
    """
    Devuelve el archivo del libro solicitado por nombre de archivo.
    """
    res = supabase.table("books").select("file_data,filename").eq("filename", filename).execute()
    if not res.data:
        return jsonify({'error': 'Libro no encontrado'}), 404
    libro = res.data[0]
    file_bytes = bytes.fromhex(libro['file_data'])
    return send_file(
        io.BytesIO(file_bytes),
        download_name=libro['filename'],
        as_attachment=False
    )

# --- Endpoint para servir la página principal ---
@app.route('/')
def home():
    """
    Devuelve el archivo HTML principal de la aplicación.
    """
    return send_file('index.html')

@app.route('/<path:filename>')
def archivos_estaticos(filename):
    return send_from_directory('.', filename)

# --- Ejecución de la aplicación ---
if __name__ == '__main__':
    app.run(debug=True)