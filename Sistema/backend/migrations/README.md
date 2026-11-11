# Primera prueba local del login de Mapeo

El script 001_auth_sistemas.sql migra las cinco cuentas conocidas a Mapeo y
protege ADMIN y el rol admin. El script valida el inventario antes de modificar
las tablas y ejecuta los cambios dentro de una transacción.

1. En SSMS, conéctate a tu instancia local y respalda la copia db_ad0a4f_gema.
2. Abre 001_auth_sistemas.sql y selecciona la base local db_ad0a4f_gema en
   la barra de SSMS. Ejecuta el script completo una sola vez.
3. Configura JWT_SECRET_KEY para el backend local. Conserva una clave privada
   existente o genera una nueva en la terminal. El cambio de formato de token
   requiere iniciar sesión nuevamente.
4. Arranca backend y frontend como de costumbre. Comprueba que el backend
   indica conexión a SQL Server y prueba login con las credenciales actuales.

Alternativa a SSMS desde la carpeta Sistema/backend, si tu instancia se
llama localhost y usas autenticación integrada de Windows:

    sqlcmd -S localhost -E -C -b -d db_ad0a4f_gema -i migrations/001_auth_sistemas.sql

Para generar una clave de prueba sin imprimirla ni guardarla en el repo:

    $env:JWT_SECRET_KEY = & ./.venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"

Comprueba que ADMIN y TEST siguen entrando como administradores. Con TEST,
verifica que ADMIN no se puede desactivar, cambiar de rol ni restablecer desde
la edición de usuarios. La contraseña propia de ADMIN se puede cambiar desde
su sesión. Prueba también una cuenta mapeador y una lectura con sus acciones
actuales. Desde Usuarios, abre Roles de Mapeo y crea un rol de prueba.

La recuperación conserva el envío mediante Brevo. Si el correo no está
configurado, se informa del fallo y no se muestra un código de prueba.
Los permisos geotécnicos existentes siguen en sus rutas originales. La
migración prepara las tablas de permisos para la etapa posterior.
