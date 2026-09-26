-- documentos_emitidos tenía dos políticas SELECT con USING (true) para anon/authenticated:
-- cualquiera con la clave pública podía listar nombres de pacientes de todos los centros.
-- La verificación pública (/verificar/[codigo]) y el panel admin leen por el servidor
-- con service_role, así que el acceso directo desde el navegador queda limitado al staff del centro.

drop policy if exists "verificacion publica" on public.documentos_emitidos;
drop policy if exists "documentos_emitidos_public_verify" on public.documentos_emitidos;

drop policy if exists "documentos_emitidos_staff_centro" on public.documentos_emitidos;
create policy "documentos_emitidos_staff_centro" on public.documentos_emitidos
  for select to authenticated
  using (public.is_staff() and public.same_centro(centro_id));

revoke all on public.documentos_emitidos from anon;
