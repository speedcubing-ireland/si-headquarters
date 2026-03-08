#!/usr/bin/env bash
# =============================================================================
# Convex Environment Setup Script
# =============================================================================
# Fill in the placeholder values below, then run this script once to push all
# environment variables to your Convex deployment.
#
# Usage:
#   chmod +x scripts/set-convex-env.sh
#   ./scripts/set-convex-env.sh
#
# IMPORTANT: Do NOT commit this file with real values filled in.
#            A pre-commit hook (githooks/pre-commit) will block you if you try.
#
# The following variables are NOT included here because they were set during
# initial setup (README step 3):
#   BETTER_AUTH_SECRET, SPONSOR_BETTER_AUTH_SECRET, CLI_AUTH_TOKEN
# =============================================================================

set -euo pipefail

# -- User Authentication ------------------------------------------------------
# OAuth credentials for staff (Google) and competitor (WCA) login.
# Source: README.md > Environment Variables > User Authentication

bunx convex env set AUTH_GOOGLE_ID        "<YOUR_AUTH_GOOGLE_ID>"
bunx convex env set AUTH_GOOGLE_SECRET    "<YOUR_AUTH_GOOGLE_SECRET>"
bunx convex env set AUTH_WCA_ID           "<YOUR_AUTH_WCA_ID>"
bunx convex env set AUTH_WCA_SECRET       "<YOUR_AUTH_WCA_SECRET>"

# Optional — only needed if the WCA service account uses 2FA (base32-encoded TOTP secret).
# bunx convex env set WCA_2FA_SECRET      "<YOUR_WCA_2FA_SECRET>"

# -- Service Integrations -----------------------------------------------------
# Machine-to-machine OAuth credentials for external APIs.
# After setting these, complete the OAuth flow by running:
#   bun run auth canva
#   bun run auth google-sheets
#   bun run auth wca

bunx convex env set SERVICE_CANVA_ID      "<YOUR_SERVICE_CANVA_ID>"
bunx convex env set SERVICE_CANVA_SECRET  "<YOUR_SERVICE_CANVA_SECRET>"
bunx convex env set SERVICE_GOOGLE_ID     "<YOUR_SERVICE_GOOGLE_ID>"
bunx convex env set SERVICE_GOOGLE_SECRET "<YOUR_SERVICE_GOOGLE_SECRET>"
bunx convex env set SERVICE_WCA_ID        "<YOUR_SERVICE_WCA_ID>"
bunx convex env set SERVICE_WCA_SECRET    "<YOUR_SERVICE_WCA_SECRET>"

# -- Email --------------------------------------------------------------------
# Azure Communication Services. Connection string format:
#   endpoint=https://<resource>.communication.azure.com/;accesskey=<key>
# The sender address domain must be verified in Azure.

bunx convex env set AZURE_EMAIL_CONNECTION_STRING "<YOUR_AZURE_EMAIL_CONNECTION_STRING>"
bunx convex env set EMAIL_SENDER_ADDRESS          "<YOUR_EMAIL_SENDER_ADDRESS>"

# -- Site Configuration -------------------------------------------------------
# These have sensible defaults (localhost:5173 for dev, hq.speedcubing.ie for
# prod) and only need to be set if you require a different base URL or custom
# CORS origins.
# bunx convex env set SITE_URL                    "<YOUR_SITE_URL>"
# bunx convex env set CORS_ALLOWED_ORIGINS        "<YOUR_CORS_ALLOWED_ORIGINS>"

echo ""
echo "Convex environment variables set successfully."
echo ""
echo "Next: complete the OAuth flow for each service integration:"
echo "  bun run auth canva"
echo "  bun run auth google-sheets"
echo "  bun run auth wca"
