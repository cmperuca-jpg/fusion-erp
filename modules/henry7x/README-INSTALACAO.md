# Fusion Henry7X v0.2 TCP

Substitua os arquivos dentro de:

modules/henry7x/

Mantenha no server.mjs:

import henry7xRoutes from "./modules/henry7x/henry7x.routes.mjs";
app.use("/api/henry7x", henry7xRoutes);

Teste:

GET http://localhost:3000/api/henry7x/status

Teste TCP com PowerShell:

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/henry7x/tcp-test" -ContentType "application/json" -Body '{"host":"IP_DA_CATRACA","port":3000,"timeoutMs":5000}'

Envio HEX manual, somente com pacote confirmado por PCAP:

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/henry7x/send-hex" -ContentType "application/json" -Body '{"host":"IP_DA_CATRACA","port":3000,"hex":"AA BB CC"}'

Observação: liberar entrada, liberar saída e piscar LED ainda estão bloqueados até preencher HEX confirmado em henry7x.commands.mjs.
