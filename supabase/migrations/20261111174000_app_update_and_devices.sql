-- App Update Settings & User Device/Version Telemetry
-- Manages Android/iOS latest versions, download URLs, optional vs force update mode,
-- and tracks each employee's app version and device hardware on startup/login.

CREATE TABLE IF NOT EXISTS public.app_release_settings (
    id TEXT PRIMARY KEY DEFAULT 'wallcraft_mobile',
    latest_version_android TEXT NOT NULL DEFAULT '2.1.1',
    download_url_android TEXT NOT NULL DEFAULT 'https://app.wallcraftthailand.com/app-release.apk',
    force_update_android BOOLEAN NOT NULL DEFAULT false,
    latest_version_ios TEXT NOT NULL DEFAULT '2.0.7',
    download_url_ios TEXT NOT NULL DEFAULT 'https://testflight.apple.com/join/BXMvdwVM',
    force_update_ios BOOLEAN NOT NULL DEFAULT false,
    release_date TEXT NOT NULL DEFAULT '2026-10-31',
    change_log TEXT NOT NULL DEFAULT 'แก้ไขการเชื่อมต่อระบบ Production และเพิ่มความเสถียร',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_release_settings (
    id,
    latest_version_android,
    download_url_android,
    force_update_android,
    latest_version_ios,
    download_url_ios,
    force_update_ios,
    release_date,
    change_log
)
VALUES (
    'wallcraft_mobile',
    '2.1.1',
    'https://app.wallcraftthailand.com/app-release.apk',
    false,
    '2.0.7',
    'https://testflight.apple.com/join/BXMvdwVM',
    false,
    '2026-10-31',
    'แก้ไขการเชื่อมต่อระบบ Production และเพิ่มความเสถียร'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_release_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wallcraft admins manage app release settings" ON public.app_release_settings;
CREATE POLICY "Wallcraft admins manage app release settings"
ON public.app_release_settings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role = 'admin'
    )
);

REVOKE ALL ON TABLE public.app_release_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_release_settings TO authenticated;
GRANT ALL ON TABLE public.app_release_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.user_app_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_key TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'other')),
    app_version TEXT NOT NULL DEFAULT '',
    build_number INTEGER,
    device_brand TEXT NOT NULL DEFAULT '',
    device_model TEXT NOT NULL DEFAULT '',
    os_version TEXT NOT NULL DEFAULT '',
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_app_devices_user_device_unique UNIQUE (user_id, device_key)
);

CREATE INDEX IF NOT EXISTS user_app_devices_last_seen_idx
    ON public.user_app_devices (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS user_app_devices_platform_version_idx
    ON public.user_app_devices (platform, app_version);

ALTER TABLE public.user_app_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wallcraft admins read all app devices" ON public.user_app_devices;
CREATE POLICY "Wallcraft admins read all app devices"
ON public.user_app_devices
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role = 'admin'
    )
);

DROP POLICY IF EXISTS "Users manage own app devices" ON public.user_app_devices;
CREATE POLICY "Users manage own app devices"
ON public.user_app_devices
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.user_app_devices FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_app_devices TO authenticated;
GRANT ALL ON TABLE public.user_app_devices TO service_role;

NOTIFY pgrst, 'reload schema';
