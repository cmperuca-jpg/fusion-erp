# Fusion Henry 7X - Pacote de Teste

Este pacote é o primeiro módulo de teste para comunicação direta com equipamentos Henry 7X.

## Instalação no Fusion

Copie a pasta:

```txt
modules/henry7x/
```

para a raiz do seu projeto Fusion ERP.

No `server.mjs`, adicione:

```js
import henry7xRouter from './modules/henry7x/henry7x.routes.mjs';
app.use('/api/henry7x', henry7xRouter);
```

O servidor precisa usar `express.json()` antes das rotas:

```js
app.use(express.json({ limit: '10mb' }));
```

## Testes

Status:

```bash
curl http://localhost:3000/api/henry7x/status
```

Cadastrar equipamento:

```bash
curl -X POST http://localhost:3000/api/henry7x/equipamentos ^
  -H "Content-Type: application/json" ^
  -d "{\"nome\":\"Catraca Henry\",\"host\":\"192.168.0.100\",\"port\":3000}"
```

Teste TCP:

```bash
curl -X POST http://localhost:3000/api/henry7x/tcp-test ^
  -H "Content-Type: application/json" ^
  -d "{\"host\":\"192.168.0.100\",\"port\":3000,\"timeoutMs\":5000}"
```

Enviar HEX confirmado por PCAP:

```bash
curl -X POST http://localhost:3000/api/henry7x/send-hex ^
  -H "Content-Type: application/json" ^
  -d "{\"host\":\"192.168.0.100\",\"port\":3000,\"hex\":\"COLE_O_HEX_AQUI\"}"
```

## Importante

Este pacote ainda não contém comandos fixos de liberar/piscar porque eles precisam ser colocados a partir dos HEX confirmados nos PCAPs. O módulo já está preparado para testar TCP e enviar pacotes HEX reais sem depender do Henry Configurações.
