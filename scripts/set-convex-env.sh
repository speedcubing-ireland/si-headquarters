#!/usr/bin/env bash
# =============================================================================
# Convex Environment Setup Script
# =============================================================================
# Fill in the placeholder values below, then run this script once to push all
# environment variables to your Convex deployment.
#
# Usage:
#   ./scripts/set-convex-env.sh            # targets dev deployment (default)
#   ./scripts/set-convex-env.sh --prod     # targets production deployment
#
# IMPORTANT: Do NOT commit this file with real values filled in.
#            A pre-commit hook (githooks/pre-commit) will block you if you try.
#
# The following variables are NOT included here because they were set during
# initial setup (README step 3):
#   BETTER_AUTH_SECRET, SPONSOR_BETTER_AUTH_SECRET, CLI_AUTH_TOKEN
# =============================================================================

set -euo pipefail

PROD_FLAG=""
TARGET="development"

if [[ "${1:-}" == "--prod" ]]; then
    PROD_FLAG="--prod"
    TARGET="production"
fi

echo "Targeting ${TARGET} deployment."
echo ""

# -- User Authentication ------------------------------------------------------
# OAuth credentials for staff (Google) and competitor (WCA) login.
# Source: README.md > Environment Variables > User Authentication

bunx convex env set $PROD_FLAG AUTH_GOOGLE_ID        "<YOUR_AUTH_GOOGLE_ID>"
bunx convex env set $PROD_FLAG AUTH_GOOGLE_SECRET    "<YOUR_AUTH_GOOGLE_SECRET>"
bunx convex env set $PROD_FLAG AUTH_WCA_ID           "<YOUR_AUTH_WCA_ID>"
bunx convex env set $PROD_FLAG AUTH_WCA_SECRET       "<YOUR_AUTH_WCA_SECRET>"

# Optional — only needed if the WCA service account uses 2FA (base32-encoded TOTP secret).
# bunx convex env set $PROD_FLAG WCA_2FA_SECRET      "<YOUR_WCA_2FA_SECRET>"

# -- Service Integrations -----------------------------------------------------
# Machine-to-machine OAuth credentials for external APIs.
# After setting these, complete the OAuth flow by running:
#   bun run auth canva            (dev)
#   bun run auth:prod canva       (prod)

bunx convex env set $PROD_FLAG SERVICE_CANVA_ID      "<YOUR_SERVICE_CANVA_ID>"
bunx convex env set $PROD_FLAG SERVICE_CANVA_SECRET  "<YOUR_SERVICE_CANVA_SECRET>"
bunx convex env set $PROD_FLAG SERVICE_GOOGLE_ID     "<YOUR_SERVICE_GOOGLE_ID>"
bunx convex env set $PROD_FLAG SERVICE_GOOGLE_SECRET "<YOUR_SERVICE_GOOGLE_SECRET>"
bunx convex env set $PROD_FLAG SERVICE_WCA_ID        "<YOUR_SERVICE_WCA_ID>"
bunx convex env set $PROD_FLAG SERVICE_WCA_SECRET    "<YOUR_SERVICE_WCA_SECRET>"

# -- Email --------------------------------------------------------------------
# Azure Communication Services. Connection string format:
#   endpoint=https://<resource>.communication.azure.com/;accesskey=<key>
# The sender address domain must be verified in Azure.

bunx convex env set $PROD_FLAG AZURE_EMAIL_CONNECTION_STRING "<YOUR_AZURE_EMAIL_CONNECTION_STRING>"
bunx convex env set $PROD_FLAG EMAIL_SENDER_ADDRESS          "<YOUR_EMAIL_SENDER_ADDRESS>"

# -- Site Configuration -------------------------------------------------------
# SITE_URL is required for development. Production defaults to https://hq.speedcubing.ie.
# SPONSOR_SITE_URL is optional — set it when the sponsor portal uses a different
# origin (e.g. different subdomain or dev port).
# CORS_ALLOWED_ORIGINS is optional — it automatically includes SITE_URL (and is
# also used to allow SPONSOR_SITE_URL to call sponsor auth endpoints).

if [[ -z "$PROD_FLAG" ]]; then
    bunx convex env set SITE_URL                         "http://localhost:5173"  # safe-value
    bunx convex env set SPONSOR_SITE_URL                 "http://localhost:5174"  # safe-value
fi
# bunx convex env set $PROD_FLAG CORS_ALLOWED_ORIGINS    "<YOUR_CORS_ALLOWED_ORIGINS>"

# WCA_BASE_URL defaults to https://www.worldcubeassociation.org — only set for local/staging WCA.
# bunx convex env set $PROD_FLAG WCA_BASE_URL            "http://localhost:3000"

# -- Feature Flags ------------------------------------------------------------
# Sponsor portal password + passkey auth. Leave unset (or set to "false") to
# restrict /sponsor/login to one-time email codes only. Set to "true" to
# re-enable password and passkey sign-in plus password reset.
# bunx convex env set $PROD_FLAG SPONSOR_PASSWORD_AUTH_ENABLED "true"

echo ""
echo "Convex ${TARGET} environment variables set successfully."
echo ""
AUTH_CMD="bun run auth"
[[ -n "$PROD_FLAG" ]] && AUTH_CMD="bun run auth:prod"
echo "Next: complete the OAuth flow for each service integration:"
echo "  $AUTH_CMD canva"
echo "  $AUTH_CMD google-sheets"
echo "  $AUTH_CMD wca"
