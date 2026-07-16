@echo off
setlocal
cd /d "%~dp0"

echo ==========================================================
echo FUSION ERP - PREPARAR SISTEMA MODELO PARA ENTREGA
echo ==========================================================
echo.
echo ATENCAO: esta operacao substitui alunos, professores,
echo usuarios e movimentacoes financeiras do tenant configurado.
echo.
echo Antes da limpeza sera criado um backup obrigatorio.
echo Serao preservados catalogos de exercicios, planos,
echo modalidades, taxas e configuracoes do sistema.
echo.
echo O resultado tera apenas:
echo - Administrador modelo
echo - Recepcao modelo
echo - Responsavel tecnico modelo
echo - Aluno modelo com avaliacao e treino ABC de hipertrofia
echo.
set /p CONFIRMA=Digite RESETAR-MODELO para confirmar: 

if /I not "%CONFIRMA%"=="RESETAR-MODELO" (
  echo Operacao cancelada.
  pause
  exit /b 0
)

node "scripts\resetar-sistema-virgem.mjs" --confirmar=RESETAR-MODELO
if errorlevel 1 (
  echo.
  echo O reset falhou. Nenhum erro deve ser ignorado.
  pause
  exit /b 1
)

echo.
echo Reset modelo concluido com sucesso.
echo Consulte CREDENCIAIS-INICIAIS-FUSION-ERP.txt
pause
