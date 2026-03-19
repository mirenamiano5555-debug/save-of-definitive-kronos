ALTER TABLE public.ues ADD COLUMN IF NOT EXISTS cota_superior double precision DEFAULT NULL;
ALTER TABLE public.ues ADD COLUMN IF NOT EXISTS cota_inferior double precision DEFAULT NULL;