#define AppName "Fusion Access"
#define AppVersion "1.0.0"
#define AppPublisher "Fusion ERP"
#define AppDir "{commonappdata}\FusionERP\AccessAgent"

[Setup]
AppId={{AE0D7EA6-A0B1-4E5C-8AB7-18D8669946B0}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={#AppDir}
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=output
OutputBaseFilename=FusionAccessSetup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
UninstallDisplayName=Fusion Access
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "..\stage\*"; DestDir: "{app}"; Excludes: "VC_redist.x64.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\stage\VC_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{commondesktop}\Status do Fusion Access"; Filename: "{app}\VER-STATUS.cmd"
Name: "{group}\Status do Fusion Access"; Filename: "{app}\VER-STATUS.cmd"

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\DESINSTALAR-SERVICO.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopFusionAccess"

[InstallDelete]
Type: files; Name: "{app}\FusionFacialWorker.ps1"
Type: files; Name: "{app}\INSTALAR-COMPREFACE.ps1"

[Code]
var
  ActivationPage: TInputQueryWizardPage;
  ExistingConfig: Boolean;

procedure InitializeWizard;
begin
  // A pasta de destino ainda não está inicializada durante InitializeWizard.
  ExistingConfig := FileExists(ExpandConstant('{commonappdata}\FusionERP\AccessAgent\agent.env'));
  ActivationPage := CreateInputQueryPage(wpSelectDir,
    'Conectar ao Fusion ERP',
    'Informe o código mostrado no painel do Fusion ERP.',
    'Abra Catracas > Instalar agente, clique em Gerar código e digite os oito números abaixo.');
  ActivationPage.Add('Endereço do Fusion:', False);
  ActivationPage.Add('Código de ativação:', False);
  ActivationPage.Values[0] := 'https://fusion-erp-8yrs.onrender.com';
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := ExistingConfig and (PageID = ActivationPage.ID);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID <> ActivationPage.ID then exit;
  if Length(ActivationPage.Values[1]) < 8 then begin
    MsgBox('Digite o código de oito números mostrado no Fusion ERP.', mbInformation, MB_OK);
    Result := False; exit;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Params: String;
begin
  if CurStep = ssPostInstall then begin
    if not Exec(ExpandConstant('{tmp}\VC_redist.x64.exe'), '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      RaiseException('Não foi possível preparar os componentes do Windows.');
    if not ExistingConfig then begin
      Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\ATIVAR.ps1') +
        '" -ServerUrl "' + ActivationPage.Values[0] + '" -Code "' + ActivationPage.Values[1] +
        '" -InstallDir "' + ExpandConstant('{app}') + '"';
      if not Exec('powershell.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
        RaiseException('A ativação não foi concluída. Gere um novo código e execute o instalador novamente.');
    end;
    Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\INSTALAR-SERVICO.ps1') +
      '" -InstallDir "' + ExpandConstant('{app}') + '"';
    if not Exec('powershell.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
      RaiseException('A inicialização automática não pôde ser configurada.');
  end;
end;
