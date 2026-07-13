#!/bin/sh
set -eu

if ! n8n export:workflow --id=avilaCollectRss01 --output=/tmp/avila-collect.json >/dev/null 2>&1; then
  n8n import:workflow --input=/opt/avila/workflows/collect-rss.json
fi
if ! n8n export:workflow --id=avilaDeliverMail1 --output=/tmp/avila-delivery.json >/dev/null 2>&1; then
  n8n import:workflow --input=/opt/avila/workflows/deliver-approved-email.json
fi
exec n8n start
