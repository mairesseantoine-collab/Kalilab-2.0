#!/bin/bash
# Installation des dépendances (exécuté une seule fois à la création du Codespace)
set -e

echo "=== Installation des dépendances backend ==="
cd /workspaces/Kalilab-2.0/backend
pip install cffi cryptography --quiet
pip install -r requirements.txt --quiet

echo "=== Installation des dépendances frontend ==="
cd /workspaces/Kalilab-2.0/frontend
npm install --silent

echo "=== Setup terminé ==="
