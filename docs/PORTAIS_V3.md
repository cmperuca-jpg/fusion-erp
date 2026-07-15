# Fusion ERP 3.0 — Consolidação dos Portais

## Portais oficiais

- Aluno: `/pages/aluno-login/index.html`
- Professor: `/pages/professor-area/index.html`
- Login do professor: `/pages/professor-login/index.html`

## Compatibilidade

As páginas antigas continuam presentes no repositório, mas suas URLs são redirecionadas para os portais oficiais. Nenhuma pasta foi apagada neste patch.

## Módulos legados

- `portal-aluno`
- `portal-aluno-operacional`
- `portal-professor`
- `professor-painel`

Esses módulos não são montados no `server.mjs`. Permanecem apenas para auditoria e futura remoção controlada.

## Regra

Novas alterações de portal devem ser feitas somente nas páginas oficiais.
