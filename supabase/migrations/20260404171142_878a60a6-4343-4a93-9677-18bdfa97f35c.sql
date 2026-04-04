CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _requested_role app_role;
  _is_visitant boolean;
BEGIN
  _requested_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', '')::app_role, 'visitant');
  _is_visitant := (_requested_role = 'visitant');
  
  INSERT INTO public.profiles (user_id, full_name, entity, location, role, approved, requested_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'entity', ''),
    NEW.raw_user_meta_data->>'location',
    'visitant'::app_role,
    _is_visitant,
    CASE WHEN _is_visitant THEN NULL ELSE _requested_role END
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'visitant'::app_role);
  
  IF NOT _is_visitant AND COALESCE(NEW.raw_user_meta_data->>'entity', '') != '' THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT p.user_id,
      'Nova sol·licitud d''usuari',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' vol unir-se com a ' || _requested_role::text,
      'user_approval',
      '/admin/users'
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role IN ('director'::app_role, 'admin'::app_role)
    WHERE p.entity = COALESCE(NEW.raw_user_meta_data->>'entity', '')
    AND p.entity != '';
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;