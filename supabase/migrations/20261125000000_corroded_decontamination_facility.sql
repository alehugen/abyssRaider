-- Santuário do evento "Corroded Decontamination Facility" (patch de 25 nov 2026).
-- Evento de 25 nov até a manutenção de 16 dez (CET): desmarque `active` depois disso.
-- Requisito do patch: item level 2.100. Pode rodar de novo (atualiza a linha).

insert into public.sanctuaries (id, name, min_item_level, group_size, sort_order, active, image_url) values
  ('corroded-decontamination-facility', 'Corroded Decontamination Facility', 2100, 10, 5, true, null)
on conflict (id) do update
  set name = excluded.name,
      min_item_level = excluded.min_item_level,
      group_size = excluded.group_size,
      sort_order = excluded.sort_order,
      active = excluded.active;
