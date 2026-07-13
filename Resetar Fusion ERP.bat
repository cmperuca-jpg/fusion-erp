@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo FUSION ERP - RESET GERAL DE TESTES
echo ==================================================
echo.
echo Este processo vai zerar:
echo - alunos
echo - matriculas
echo - mensalidades
echo - financeiro
echo - recebimentos
echo - caixa
echo - avaliacoes
echo - treinos
echo - biometrias
echo - check-ins e acessos
echo.
echo Serao preservados:
echo - professores
echo - administradores
echo - funcionarios
echo - usuarios
echo - planos
echo - modalidades
echo - configuracoes
echo - dispositivos e Henry 7X
echo.
echo Um backup automatico sera criado antes da limpeza.
echo.
set /p CONFIRMA=Digite RESETAR para confirmar: 

if /I not "%CONFIRMA%"=="RESETAR" (
  echo Operacao cancelada.
  pause
  exit /b 0
)

node "scripts\resetar-piloto.mjs"
if errorlevel 1 (
  echo.
  echo O reset falhou. Verifique a mensagem acima.
  pause
  exit /b 1
)

echo.
echo Reset concluido com sucesso.
pause
