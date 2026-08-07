# Fluxo oficial de autenticação multiacademia

```text
/pages/comecar/
    ↓
Academia + código da academia
    ↓
seleção temporária assinada (20 min)
    ↓
/pages/login/index.html?tenant=<tenant>
    ↓
E-mail + senha do usuário interno
    ↓
JWT com tenantId + perfil + permissões
    ↓
Dashboard / área permitida
```

Perfis internos continuam individuais. O mesmo código da academia é usado para localizar a empresa, enquanto cada funcionário mantém seu próprio e-mail, senha e permissões.
