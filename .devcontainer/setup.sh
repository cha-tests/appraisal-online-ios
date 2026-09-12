#!/usr/bin/env bash
# Runs automatically once when a Codespace is created (postCreateCommand in
# devcontainer.json). Goal: a codespace opened from a phone browser is ready
# to run `npm run dev -- --tunnel` with no typing beyond that one command —
# no manually retyped .env, no interactive ngrok prompt.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing mobile dependencies"
(cd mobile && npm install)

echo "==> Pre-installing @expo/ngrok (avoids the interactive prompt on first --tunnel run)"
npm install -g @expo/ngrok@^4.1.0

# GitHub Codespaces secrets (set at github.com/settings/codespaces, or the
# repo's Settings > Secrets and variables > Codespaces) are injected as
# plain environment variables into every codespace automatically — no
# per-session setup needed once they're configured. Real values from there
# take priority; anything not set falls back to a placeholder, which is
# enough to boot the app and test pure UI/logic (see mobile/.env.example
# and CLAUDE.md for what each placeholder actually gates).
env_or_placeholder() {
  local value="${!1:-}"
  if [ -n "$value" ]; then
    echo "$value"
  else
    echo "$2"
  fi
}

cat > mobile/.env <<EOF
EXPO_PUBLIC_SUPABASE_URL=$(env_or_placeholder EXPO_PUBLIC_SUPABASE_URL "https://placeholder.supabase.co")
EXPO_PUBLIC_SUPABASE_ANON_KEY=$(env_or_placeholder EXPO_PUBLIC_SUPABASE_ANON_KEY "placeholder-anon-key")
EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY=$(env_or_placeholder EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY "placeholder")
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=$(env_or_placeholder EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY "pk_test_placeholder")
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=$(env_or_placeholder EXPO_PUBLIC_GOOGLE_PLACES_API_KEY "placeholder")
EOF

if [ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" ]; then
  echo ""
  echo "==> No Codespaces secrets found — mobile/.env was written with placeholders."
  echo "    Signup/login, address search, AI valuation, and payment will not work."
  echo "    Pure UI/navigation testing works fine as-is."
  echo "    To enable real backend testing from any device: add"
  echo "      EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,"
  echo "      EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY, EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,"
  echo "      EXPO_PUBLIC_GOOGLE_PLACES_API_KEY"
  echo "    as Codespaces secrets (github.com/settings/codespaces -> Repository"
  echo "    access -> this repo), then create a new codespace."
else
  echo "==> Codespaces secrets found — mobile/.env written with real values."
fi

echo "==> Setup complete. Run: cd mobile && npm run dev:phone"
