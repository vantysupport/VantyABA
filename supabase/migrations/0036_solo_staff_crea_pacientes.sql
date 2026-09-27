-- Solo el área administrativa (jefe, admin, secretaría, especialista) registra pacientes.
-- La familia ya no puede crear niños desde su portal: el centro los registra y los vincula a su cuenta.

-- La política amplia "Padres ven sus hijos" valía para TODAS las operaciones (incluido INSERT).
drop policy if exists "Padres ven sus hijos" on public.children;
create policy "Padres ven sus hijos" on public.children
  for select using ((auth.uid() = parent_id) and same_centro(centro_id));

-- Crear pacientes: solo staff del mismo centro
drop policy if exists children_insert on public.children;
create policy children_insert on public.children
  for insert to authenticated with check (is_staff() and same_centro(centro_id));
