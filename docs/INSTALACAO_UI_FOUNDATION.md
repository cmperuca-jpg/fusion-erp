# Fusion ERP - UI Foundation

## Como instalar

1. Extraia o ZIP.
2. Copie a pasta `public` para dentro da pasta principal do projeto `site erp`.
3. Quando o Windows perguntar se deseja mesclar as pastas, clique em **Sim**.
4. Quando perguntar sobre substituir arquivos, substitua estes arquivos:
   - `public/css/layout.css`
   - `public/js/layout.js`

## Arquivos adicionados

- `public/css/reset.css`
- `public/css/variables.css`
- `public/css/layout.css`
- `public/css/components.css`
- `public/css/forms.css`
- `public/css/tables.css`
- `public/css/responsive.css`
- `public/js/layout.js`
- `public/js/toast.js`
- `public/js/modal.js`
- `public/js/api.js`
- `public/js/auth.js`
- `public/js/utils.js`

## Ajuste recomendado nas páginas

Em cada página HTML do sistema, mantenha pelo menos:

```html
<link rel="stylesheet" href="/css/layout.css" />
<link rel="stylesheet" href="/css/components.css" />
<link rel="stylesheet" href="/css/tables.css" />
```

No fim do body:

```html
<script src="/js/layout.js"></script>
```

A página deve possuir:

```html
<main class="main">
  ...conteúdo da página...
</main>
```
