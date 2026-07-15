# Fusion ERP 3.0 — Segurança

Este patch centraliza a proteção das APIs e migra as senhas para bcrypt.

## Compatibilidade de senhas

Usuários antigos com hash SHA-256 continuam entrando normalmente. No primeiro login correto, a senha é convertida automaticamente para bcrypt e o hash antigo é removido.

## Ambiente local

O sistema funciona sem configurar CORS. Recomenda-se criar um JWT_SECRET no arquivo `.env` antes de uso real.

## Rotas públicas

Somente login, matrícula online, leads, chat público, aparência pública e diagnósticos básicos permanecem sem token.

## Rotas administrativas

Backup, importadores, usuários, catraca, access engine e bridge exigem administrador.
