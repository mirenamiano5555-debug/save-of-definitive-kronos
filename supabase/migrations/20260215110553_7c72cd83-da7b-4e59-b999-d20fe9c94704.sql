
-- Role enum
CREATE TYPE public.app_role AS ENUM ('treballador', 'cap');
CREATE TYPE public.visibility_type AS ENUM ('esbos', 'entitat', 'public');
CREATE TYPE public.item_type AS ENUM ('objecte', 'ue', 'jaciment');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  location TEXT,
  entity TEXT NOT NULL DEFAULT '',
  role app_role NOT NULL DEFAULT 'treballador',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- User roles table for admin checks
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, entity)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'entity', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'treballador'));
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Jaciments (Sites)
CREATE TABLE public.jaciments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  period TEXT,
  description TEXT,
  visibility visibility_type NOT NULL DEFAULT 'public',
  entity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jaciments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public jaciments viewable by all" ON public.jaciments FOR SELECT USING (
  visibility = 'public' OR created_by = auth.uid() OR
  (visibility = 'entitat' AND EXISTS (
    SELECT 1 FROM public.profiles p1, public.profiles p2 
    WHERE p1.user_id = auth.uid() AND p2.user_id = jaciments.created_by AND p1.entity = p2.entity
  ))
);
CREATE POLICY "Cap users can create jaciments" ON public.jaciments FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update jaciments" ON public.jaciments FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete jaciments" ON public.jaciments FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_jaciments_updated_at BEFORE UPDATE ON public.jaciments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Unitats Estratigràfiques (UE)
CREATE TABLE public.ues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  jaciment_id UUID REFERENCES public.jaciments(id) ON DELETE CASCADE NOT NULL,
  codi_ue TEXT,
  data_creacio DATE DEFAULT CURRENT_DATE,
  campanya TEXT,
  terme_municipal TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  comarca TEXT,
  zona TEXT,
  sector TEXT,
  ambit TEXT,
  fet TEXT,
  descripcio TEXT,
  color TEXT,
  consistencia TEXT,
  igual_a TEXT,
  tallat_per TEXT,
  es_recolza_a TEXT,
  se_li_recolza TEXT,
  talla TEXT,
  reomplert_per TEXT,
  cobert_per TEXT,
  reomple_a TEXT,
  cobreix_a TEXT,
  interpretacio TEXT,
  cronologia TEXT,
  criteri TEXT,
  materials TEXT,
  planta TEXT,
  seccio TEXT,
  fotografia TEXT,
  sediment TEXT,
  carpologia TEXT,
  antracologia TEXT,
  fauna TEXT,
  metalls TEXT,
  observacions TEXT,
  image_url TEXT,
  visibility visibility_type NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public ues viewable by all" ON public.ues FOR SELECT USING (
  visibility = 'public' OR created_by = auth.uid() OR
  (visibility = 'entitat' AND EXISTS (
    SELECT 1 FROM public.profiles p1, public.profiles p2 
    WHERE p1.user_id = auth.uid() AND p2.user_id = ues.created_by AND p1.entity = p2.entity
  ))
);
CREATE POLICY "Users can create ues" ON public.ues FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update ues" ON public.ues FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete ues" ON public.ues FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_ues_updated_at BEFORE UPDATE ON public.ues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Objectes
CREATE TABLE public.objectes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  jaciment_id UUID REFERENCES public.jaciments(id) ON DELETE CASCADE NOT NULL,
  ue_id UUID REFERENCES public.ues(id) ON DELETE SET NULL,
  object_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  data_descobriment DATE,
  data_origen TEXT,
  estacio_gps TEXT,
  codi_nivell TEXT,
  subunitat TEXT,
  tipus TEXT,
  image_url TEXT,
  persona_registra TEXT,
  mida_x DOUBLE PRECISION,
  mida_y DOUBLE PRECISION,
  altres_nums TEXT,
  estat_conservacio INTEGER CHECK (estat_conservacio BETWEEN 1 AND 5),
  visibility visibility_type NOT NULL DEFAULT 'public',
  qr_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.objectes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public objectes viewable by all" ON public.objectes FOR SELECT USING (
  visibility = 'public' OR created_by = auth.uid() OR
  (visibility = 'entitat' AND EXISTS (
    SELECT 1 FROM public.profiles p1, public.profiles p2 
    WHERE p1.user_id = auth.uid() AND p2.user_id = objectes.created_by AND p1.entity = p2.entity
  ))
);
CREATE POLICY "Users can create objectes" ON public.objectes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update objectes" ON public.objectes FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete objectes" ON public.objectes FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_objectes_updated_at BEFORE UPDATE ON public.objectes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Templates
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type item_type NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own templates" ON public.templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create templates" ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update templates" ON public.templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete templates" ON public.templates FOR DELETE USING (auth.uid() = user_id);

-- Messages (direct chat)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE USING (auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view images" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Auth users can upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own images" ON storage.objects FOR UPDATE USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own images" ON storage.objects FOR DELETE USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);
