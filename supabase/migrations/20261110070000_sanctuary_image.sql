-- Imagem de fundo de cada santuário (exibida no topo da página da party).
-- Edite pelo Table Editor ao ativar santuários novos.

alter table public.sanctuaries add column image_url text;

-- Captura oficial do Ludra, da notícia "Ludra desperta" no site do Aion 2 (CDN da NCSOFT).
update public.sanctuaries
   set image_url = 'https://fizz-download.playnccdn.com/download/v2/buckets/conti-upload/files/1a1a3b9ac4e-b936c323-6cbb-4357-9c39-9367df642465'
 where id = 'ludra';
