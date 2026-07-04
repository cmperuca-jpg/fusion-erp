# PATCH_SERVER_MJS.md

Adicione o import:

```javascript
import turmasRoutes from "./modules/turmas/turmas.routes.mjs";
```

Adicione a rota:

```javascript
app.use("/api/turmas", turmasRoutes);
```

## server.mjs completo sugerido

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import alunosRoutes from "./modules/alunos/alunos.routes.mjs";
import professoresRoutes from "./modules/professores/professores.routes.mjs";
import modalidadesRoutes from "./modules/modalidades/modalidades.routes.mjs";
import planosRoutes from "./modules/planos/planos.routes.mjs";
import turmasRoutes from "./modules/turmas/turmas.routes.mjs";
import avaliacoesRoutes from "./modules/avaliacoes/avaliacoes.routes.mjs";
import exerciciosRoutes from "./modules/exercicios/exercicios.routes.mjs";
import treinosRoutes from "./modules/treinos/treinos.routes.mjs";

// restante igual
```
