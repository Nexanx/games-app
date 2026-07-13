# Frontend tests

The frontend test suite uses Vitest. It covers pure view helpers, API/error formatting, server-rendered UI contracts and regression checks for Dashboard, backlog, completed games, Analytics, PoE and year navigation.

Run the suite from `frontend/`:

```powershell
npm test
```

Responsive browser smoke checks are currently performed separately; there is no committed end-to-end browser runner in this repository.
