#!/usr/bin/env bash
# PROTOTYPE — une commande, deux exécutions
set -u
cd "$(dirname "$0")"
echo ""
echo "═══ 1. LE CÔTÉ DISTRIBUÉ : ce que l'utilisateur installe ═══════════════════"
node --test signals.test.mjs 2>&1 | grep -E "^(✔|✖|ℹ (pass|fail))|not ok|AssertionError|actual|expected" | head -30
echo ""
echo "═══ 2. LE CÔTÉ DÉPÔT : le même fichier contre la baseline ═══════════════════"
node harness.mjs
