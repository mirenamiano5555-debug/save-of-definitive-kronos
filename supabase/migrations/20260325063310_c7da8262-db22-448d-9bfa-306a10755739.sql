
-- Create a security definer function to check if user is director of the same entity as the item creator
CREATE OR REPLACE FUNCTION public.is_director_same_entity(_user_id uuid, _creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p_director
    JOIN public.user_roles ur ON ur.user_id = p_director.user_id
    JOIN public.profiles p_creator ON p_creator.entity = p_director.entity
    WHERE p_director.user_id = _user_id
      AND ur.role = 'director'
      AND p_creator.user_id = _creator_id
      AND p_director.entity != ''
  )
$$;

-- Update jaciments UPDATE policy to allow directors of same entity
DROP POLICY IF EXISTS "Creators can update jaciments" ON public.jaciments;
CREATE POLICY "Creators or directors can update jaciments" ON public.jaciments
FOR UPDATE TO public
USING (auth.uid() = created_by OR public.is_director_same_entity(auth.uid(), created_by));

-- Update ues UPDATE policy
DROP POLICY IF EXISTS "Creators can update ues" ON public.ues;
CREATE POLICY "Creators or directors can update ues" ON public.ues
FOR UPDATE TO public
USING (auth.uid() = created_by OR public.is_director_same_entity(auth.uid(), created_by));

-- Update objectes UPDATE policy
DROP POLICY IF EXISTS "Creators can update objectes" ON public.objectes;
CREATE POLICY "Creators or directors can update objectes" ON public.objectes
FOR UPDATE TO public
USING (auth.uid() = created_by OR public.is_director_same_entity(auth.uid(), created_by));
