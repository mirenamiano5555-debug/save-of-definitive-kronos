
-- Add approved column to profiles (visitants auto-approved, others need director approval)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requested_role app_role NULL;

-- Auto-approve all existing users
UPDATE public.profiles SET approved = true;

-- Allow directors to update profiles of same-entity users (for approval/role changes)
CREATE POLICY "Directors can update same entity profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_director_same_entity(auth.uid(), user_id))
WITH CHECK (is_director_same_entity(auth.uid(), user_id));

-- Allow directors to update user_roles of same-entity users
CREATE POLICY "Directors can update same entity roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p1.entity = p2.entity
    JOIN public.user_roles ur ON ur.user_id = p1.user_id AND ur.role = 'director'
    WHERE p1.user_id = auth.uid() AND p2.user_id = user_roles.user_id AND p1.entity != ''
  )
);

-- Allow directors to delete user_roles (for role changes)
CREATE POLICY "Directors can delete same entity roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p1.entity = p2.entity
    JOIN public.user_roles ur ON ur.user_id = p1.user_id AND ur.role = 'director'
    WHERE p1.user_id = auth.uid() AND p2.user_id = user_roles.user_id AND p1.entity != ''
  )
);

-- Allow directors to insert roles for same-entity users
CREATE POLICY "Directors can insert same entity roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id) OR
  EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p1.entity = p2.entity
    JOIN public.user_roles ur ON ur.user_id = p1.user_id AND ur.role = 'director'
    WHERE p1.user_id = auth.uid() AND p2.user_id = user_roles.user_id AND p1.entity != ''
  )
);

-- Drop old insert policy and recreate to keep both
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- Update handle_new_user trigger to handle approval logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _requested_role app_role;
  _is_visitant boolean;
BEGIN
  _requested_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'tecnic');
  _is_visitant := (_requested_role = 'visitant');
  
  INSERT INTO public.profiles (user_id, full_name, entity, role, approved, requested_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'entity', ''),
    CASE WHEN _is_visitant THEN 'visitant' ELSE 'visitant' END,
    _is_visitant,
    CASE WHEN _is_visitant THEN NULL ELSE _requested_role END
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'visitant');
  
  -- Notify directors of same entity if not visitant
  IF NOT _is_visitant AND COALESCE(NEW.raw_user_meta_data->>'entity', '') != '' THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT p.user_id,
      'Nova sol·licitud d''usuari',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' vol unir-se com a ' || _requested_role::text,
      'user_approval',
      '/admin/users'
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'director'
    WHERE p.entity = COALESCE(NEW.raw_user_meta_data->>'entity', '')
    AND p.entity != '';
  END IF;
  
  RETURN NEW;
END;
$$;
