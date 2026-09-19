-- When a user signs up, create their profile and wallet accounts automatically.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create the profile row
  INSERT INTO public.profiles (user_id, display_name, verification_status, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'unverified',
    'user'
  );

  -- Create the three user-owned wallet accounts
  INSERT INTO public.accounts (owner_user_id, purpose, asset) VALUES
    (NEW.id, 'mwk_wallet',   'MWK'),
    (NEW.id, 'usdt_wallet',  'USDT'),
    (NEW.id, 'card_funding', 'USDT');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
