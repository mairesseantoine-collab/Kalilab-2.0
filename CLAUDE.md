# Instructions pour Claude Code — KaliLab 2.0

## Règle absolue : commit + push après chaque modification

**Après chaque tâche ou groupe de modifications**, toujours faire :

```bash
cd /c/Users/Utilisateur/OneDrive/ANTOINE/CLAUDE/kalilab
git add -A
git commit -m "description des changements\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

- Dépôt : https://github.com/mairesseantoine-collab/Kalilab-2.0
- Branche principale : `main`
- Ne jamais laisser des modifications sans les pousser sur GitHub

## Stack
- Backend : FastAPI + SQLite + SQLModel (`backend/`)
- Frontend : React + TypeScript + MUI v5 (`frontend/`)
- Port backend : 8000
- Port frontend : 5173

## Démarrage
```
backend/  → venv\Scripts\activate && uvicorn main:app --reload
frontend/ → npm run dev
```
