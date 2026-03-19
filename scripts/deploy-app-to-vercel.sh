#!/usr/bin/env bash
#
# Deploy the Elevio connector to Vercel.
#
# Links to the correct Vercel project (mavenagi-developer-app-{env}-{appId}),
# runs tests and build, then deploys.
#
# Usage:
#   ./scripts/deploy-app-to-vercel.sh <mavenagi-app-id> [environment]
#   pnpm run deploy-app.beta  (reads MAVENAGI_APP_ID from .env.local)
#
# Arguments:
#   mavenagi-app-id    The MAVENAGI_APP_ID to deploy (e.g., "elevio")
#   environment        Optional: "production" (default), "staging", or "development"
#
# Required environment variables:
#   VERCEL_API_TOKEN   Vercel API token

set -euo pipefail

MAVENAGI_APP_ID="${1:-}"
ENVIRONMENT="${2:-production}"

if [ -z "$MAVENAGI_APP_ID" ]; then
  echo "Error: MAVENAGI_APP_ID argument is required."
  echo ""
  echo "Usage: $0 <mavenagi-app-id> [environment]"
  echo "  e.g., $0 elevio"
  echo "  e.g., $0 elevio staging"
  exit 1
fi

if [ -z "${VERCEL_API_TOKEN:-}" ]; then
  echo "Error: VERCEL_API_TOKEN is not set."
  echo "Add it to .env.local or set it as an environment variable."
  exit 1
fi

VERCEL_PROJECT="mavenagi-developer-app-${ENVIRONMENT}-${MAVENAGI_APP_ID}"

echo "Running tests..."
pnpm test

echo "Building..."
pnpm build

# Link to the correct Vercel project
echo "Linking to Vercel project: $VERCEL_PROJECT"
npx vercel link \
  --yes \
  --scope mavenagi \
  --project "$VERCEL_PROJECT" \
  --token "$VERCEL_API_TOKEN"

echo "Deploying MAVENAGI_APP_ID=$MAVENAGI_APP_ID to Vercel project $VERCEL_PROJECT..."
npx vercel deploy \
  --prod \
  --yes \
  --scope mavenagi \
  --token "$VERCEL_API_TOKEN"
