BEGIN;

CREATE TABLE IF NOT EXISTS public.fusion_app_local_users (
  user_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  legacy_id text NOT NULL,
  cpf text NOT NULL,
  nome text NOT NULL DEFAULT '',
  telefone text,
  data_nascimento date,
  matricula text,
  status text NOT NULL DEFAULT 'ativo',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  password_hash text,
  password_set_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fusion_app_local_users_tenant_legacy_uk UNIQUE (tenant_id, legacy_id),
  CONSTRAINT fusion_app_local_users_tenant_cpf_uk UNIQUE (tenant_id, cpf)
);

CREATE INDEX IF NOT EXISTS fusion_app_local_users_tenant_idx
  ON public.fusion_app_local_users(tenant_id);
CREATE INDEX IF NOT EXISTS fusion_app_local_users_password_idx
  ON public.fusion_app_local_users(tenant_id, legacy_id)
  WHERE password_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fusion_app_local_activation_codes (
  code_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.fusion_app_local_users(user_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fusion_app_local_activation_codes_user_idx
  ON public.fusion_app_local_activation_codes(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS fusion_app_local_activation_codes_active_idx
  ON public.fusion_app_local_activation_codes(tenant_id, expires_at DESC)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fusion_app_local_devices (
  device_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.fusion_app_local_users(user_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  installation_hash text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  name text NOT NULL DEFAULT 'Navegador web',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fusion_app_local_devices_user_installation_uk UNIQUE (user_id, installation_hash)
);

CREATE INDEX IF NOT EXISTS fusion_app_local_devices_user_idx
  ON public.fusion_app_local_devices(user_id, status);

CREATE TABLE IF NOT EXISTS public.fusion_app_local_sessions (
  session_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.fusion_app_local_users(user_id) ON DELETE CASCADE,
  access_hash text NOT NULL UNIQUE,
  refresh_hash text NOT NULL UNIQUE,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fusion_app_local_sessions_user_idx
  ON public.fusion_app_local_sessions(user_id, active, refresh_expires_at DESC);

CREATE TABLE IF NOT EXISTS public.fusion_app_local_auth_attempts (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  identifier_hash text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fusion_app_local_auth_attempts_lookup_idx
  ON public.fusion_app_local_auth_attempts(kind, identifier_hash, attempted_at DESC);

COMMIT;
