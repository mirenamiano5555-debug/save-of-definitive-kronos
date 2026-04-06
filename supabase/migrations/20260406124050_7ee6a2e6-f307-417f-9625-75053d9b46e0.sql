
CREATE TABLE IF NOT EXISTS public.banned_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  banned_by uuid NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

ALTER TABLE public.banned_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view banned emails" ON public.banned_emails
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert banned emails" ON public.banned_emails
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete banned emails" ON public.banned_emails
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
