-- Convierte una cuenta ya registrada en la cuenta oficial @kiemas.
--
-- NO es una migración: se ejecuta una sola vez, a mano, en el editor SQL de
-- Supabase, después de registrar en la app la cuenta con el correo oficial.
-- Se salta `set_username` a propósito: «kiemas» está en `reserved_usernames`
-- precisamente para que nadie más pueda reclamarlo, y desde la app esa ruta
-- está cerrada también para ti.
--
-- Cambia el correo por el de la cuenta que hayas registrado.

update public.profiles
   set username = 'kiemas',
       display_name = 'Kiemas'
 where id = (select id from auth.users where email = 'hola@kiemas.com');

-- Comprobación: debe devolver una fila con username = 'kiemas'.
select id, username, display_name
  from public.profiles
 where username = 'kiemas';
