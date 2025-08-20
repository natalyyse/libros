from flask import Flask, request, jsonify, send_file, send_from_directory
from supabase import create_client
import io
from decouple import config
import jwt
import datetime
import bcrypt
from functools import wraps
import os

# --- Configuración global ---
SECRET_KEY = "supersecretkey"  # Cambia esto por algo seguro

# --- Inicialización de Supabase ---
url = config("SUPABASE_URL")
key = config("SUPABASE_KEY")
supabase = create_client(url, key)

# --- Inicialización de la aplicación Flask ---
app = Flask(__name__)

# --- Decorador para requerir login mediante JWT ---
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token requerido'}), 401
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user_id = payload['user_id']
        except Exception:
            return jsonify({'error': 'Token inválido'}), 401
        return f(*args, **kwargs)
    return decorated

# --- Registro de usuario ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Faltan datos'}), 400
    # Verifica si el usuario ya existe
    res = supabase.table("users").select("username").eq("username", username).execute()
    if res.data:
        return jsonify({'error': 'Usuario ya existe'}), 409
    # Encripta el password antes de guardar
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    supabase.table("users").insert({"username": username, "password": hashed}).execute()
    return jsonify({'message': 'Usuario registrado correctamente'}), 201

# --- Login de usuario ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    res = supabase.table("users").select("id,username,password").eq("username", username).execute()
    if not res.data:
        return jsonify({'error': 'Credenciales inválidas'}), 401
    user = res.data[0]
    hashed = user['password']
    if not bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8')):
        return jsonify({'error': 'Credenciales inválidas'}), 401
    # Genera el token JWT
    token = jwt.encode({
        'user_id': user['id'],
        'username': username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    }, SECRET_KEY, algorithm="HS256")
    return jsonify({'token': token})

# --- Obtener lista de libros del usuario ---
@app.route('/api/libros', methods=['GET'])
@login_required
def obtener_libros():
    res = supabase.table("books").select("title,filename").eq("user_id", request.user_id).execute()
    libros = res.data
    for libro in libros:
        libro['public_url'] = f'/storage/{libro["filename"]}'
    return jsonify(libros)

# --- Carpeta de almacenamiento local ---
STORAGE_FOLDER = 'libros_storage'
os.makedirs(STORAGE_FOLDER, exist_ok=True)

# --- Agregar libro para el usuario ---
@app.route('/api/libros', methods=['POST'])
@login_required
def agregar_libro():
    if 'file' not in request.files:
        return jsonify({'error': 'No se envió archivo'}), 400
    file = request.files['file']
    filename = file.filename
    title = request.form.get('title', filename)
    mime_type = file.mimetype

    # Guarda el archivo en la carpeta local
    file_path = os.path.join(STORAGE_FOLDER, filename)
    file.save(file_path)

    # Guarda solo la ruta en la base de datos
    public_url = f'/storage/{filename}'
    data = {
        "title": title,
        "filename": filename,
        "mime_type": mime_type,
        "public_url": public_url,
        "user_id": request.user_id
    }
    supabase.table("books").insert(data).execute()
    return jsonify({'message': 'Libro agregado correctamente', 'public_url': public_url}), 201

# --- Descargar o mostrar libro específico desde la carpeta local ---
@app.route('/storage/<filename>', methods=['GET'])
@login_required
def mostrar_libro(filename):
    file_path = os.path.join(STORAGE_FOLDER, filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'Libro no encontrado'}), 404
    return send_file(file_path, download_name=filename, as_attachment=False)

# --- Servir archivos estáticos y páginas principales ---
@app.route('/')
def home():
    return send_file('login.html')

@app.route('/index.html')
def index():
    return send_file('index.html')

@app.route('/<path:filename>')
def archivos_estaticos(filename):
    return send_from_directory('.', filename)

# --- Ejecutar la aplicación ---
if __name__ == '__main__':
    app.run(debug=True)