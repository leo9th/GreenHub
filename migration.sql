-- 1. Add 'gender' column to 'profiles' table if it doesn't already exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text check (gender in ('Male', 'Female', 'Prefer not to say', ''));

-- 2. Update the 'handle_new_user' trigger function to inject gender on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, state, lga, address, gender)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'lga',
    new.raw_user_meta_data->>'address',
    COALESCE(NULLIF(new.raw_user_meta_data->>'gender', ''), 'Prefer not to say')
  );
  RETURN new;
END;
$$ language plpgsql security definer;
