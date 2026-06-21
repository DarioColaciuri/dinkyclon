-- Ejecutar en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/srxpzwwgsdtjqrwranqt/sql/new

-- Tabla de perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nickname TEXT NOT NULL,
  elo INTEGER DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede leer perfiles"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Usuario inserta su propio perfil"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuario actualiza su propio perfil"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: crea el perfil automaticamente al registrarse (bypassea RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, elo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'Player'),
    500
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
