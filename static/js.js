// --- Animación del formulario al enfocar el campo contraseña ---
$('#password').focusin(function(){
  $('form').addClass('up');
});
$('#password').focusout(function(){
  $('form').removeClass('up');
});

// --- Movimiento de los ojos del panda según el mouse ---
$(document).on( "mousemove", function( event ) {
  var dw = $(document).width() / 15;
  var dh = $(document).height() / 15;
  var x = event.pageX/ dw;
  var y = event.pageY/ dh;
  $('.eye-ball').css({
    width : x,
    height : y
  });
});

// --- Validación de formulario ---
$('.btn').click(function(){
  $('form').addClass('wrong-entry');
    setTimeout(function(){ 
       $('form').removeClass('wrong-entry');
     },3000 );
});

$(function() {
  // Mostrar formulario de registro
  $('#show-register').on('click', function(e) {
    e.preventDefault();
    $('#form-title').text('Registro');
    $('#main-btn-login').hide();
    $('#main-btn-register').show();
    $('.alert').hide();
    $('#username').val('');
    $('#password').val('');
  });

  $('#show-register').click(function() {
    $('#form-title').text('Registro');
    $('#main-btn-login').hide();
    $('#main-btn-register').show();
    $('#login-link').show();
    $(this).parent().hide();
  });

  $('#show-login').click(function() {
    $('#form-title').text('Login');
    $('#main-btn-login').show();
    $('#main-btn-register').hide();
    $('#login-link').hide();
    $('#show-register').parent().show();
  });

  // Registro
  $('#main-btn-register').on('click', function(e) {
    e.preventDefault();
    const username = $('#username').val();
    const password = $('#password').val();
    if (!username || !password) {
      alert('Debes ingresar usuario y contraseña');
      return;
    }
    $.ajax({
      url: '/api/register',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ username, password }),
      success: function() {
        $('#username').val('');
        $('#password').val('');
        $('#form-title').text('Panda Login');
        $('#main-btn-register').hide();
        $('#main-btn-login').show();
        alert('Registro exitoso, ahora inicia sesión.');
      },
      error: function(xhr) {
        alert(xhr.responseJSON?.error || 'Error en el registro');
      }
    });
  });

  // Login
  $('#main-btn-login').on('click', function(e) {
    e.preventDefault();
    const username = $('#username').val();
    const password = $('#password').val();
    if (!username || !password) {
      $('.alert').show();
      return;
    }
    $.ajax({
      url: '/api/login',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ username, password }),
      success: function(res) {
        authToken = res.token;
        $('.alert').hide();
        localStorage.setItem('authToken', authToken);
        window.location.href = '/index.html';
      },
      error: function() {
        $('.alert').show();
      }
    });
  });
});

let authToken = null;

// Mostrar sección de libros
function mostrarLibros() {
  $('#login-form').hide();
  $('#libros-section').show();
  $.ajax({
    url: '/api/libros',
    method: 'GET',
    headers: { 'Authorization': authToken },
    success: function(libros) {
      let html = '';
      libros.forEach(libro => {
        html += `<li><a href="${libro.public_url}" target="_blank">${libro.title}</a></li>`;
      });
      $('#libros-list').html(html);
    },
    error: function() {
      $('#libros-list').html('<li>Error al cargar libros</li>');
    }
  });
}

// Logout
$('#logout-btn').on('click', function() {
  authToken = null;
  $('#libros-section').hide();
  $('#login-form').show();
});

