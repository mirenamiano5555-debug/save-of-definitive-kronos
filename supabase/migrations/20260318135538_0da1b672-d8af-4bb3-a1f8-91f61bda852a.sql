
-- Add closed field to jaciments
ALTER TABLE public.jaciments ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT false;

-- Create change_logs table
CREATE TABLE public.change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  user_id uuid NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view change logs" ON public.change_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert logs" ON public.change_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
