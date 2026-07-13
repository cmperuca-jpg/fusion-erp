$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Port = 3041
$Base = "http://127.0.0.1:$Port/"
$DllPath = Join-Path $PSScriptRoot "ftrScanAPI.dll"
$script:Modo = "acesso"
$script:Handle = [IntPtr]::Zero
$script:ImageSize = $null
$script:UltimoErro = ""

if (-not (Test-Path $DllPath)) {
  Write-Host "ERRO: copie ftrScanAPI.dll para $PSScriptRoot" -ForegroundColor Red
  exit 1
}

$native = @"
using System;
using System.Runtime.InteropServices;
public static class FutronicNative {
  [StructLayout(LayoutKind.Sequential, Pack=1)]
  public struct ImageSize { public int nWidth; public int nHeight; public int nImageSize; }
  [DllImport("ftrScanAPI.dll", CallingConvention=CallingConvention.StdCall, SetLastError=true)]
  public static extern IntPtr ftrScanOpenDevice();
  [DllImport("ftrScanAPI.dll", CallingConvention=CallingConvention.StdCall, SetLastError=true)]
  public static extern void ftrScanCloseDevice(IntPtr handle);
  [DllImport("ftrScanAPI.dll", CallingConvention=CallingConvention.StdCall, SetLastError=true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool ftrScanGetImageSize(IntPtr handle, out ImageSize imageSize);
  [DllImport("ftrScanAPI.dll", CallingConvention=CallingConvention.StdCall, SetLastError=true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool ftrScanGetFrame(IntPtr handle, byte[] buffer, IntPtr frameParameters);
}
"@

Add-Type -TypeDefinition $native -Language CSharp

function Open-Reader {
  if ($script:Handle -ne [IntPtr]::Zero) { return $true }
  $script:Handle = [FutronicNative]::ftrScanOpenDevice()
  if ($script:Handle -eq [IntPtr]::Zero) {
    $script:UltimoErro = "Leitor não encontrado. Código Windows: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    return $false
  }
  $size = New-Object FutronicNative+ImageSize
  if (-not [FutronicNative]::ftrScanGetImageSize($script:Handle, [ref]$size)) {
    [FutronicNative]::ftrScanCloseDevice($script:Handle)
    $script:Handle = [IntPtr]::Zero
    $script:UltimoErro = "Não foi possível obter o tamanho da imagem."
    return $false
  }
  $script:ImageSize = $size
  $script:UltimoErro = ""
  return $true
}

function Close-Reader {
  if ($script:Handle -ne [IntPtr]::Zero) {
    try { [FutronicNative]::ftrScanCloseDevice($script:Handle) } catch {}
    $script:Handle = [IntPtr]::Zero
  }
}

function Get-Quality([byte[]]$Buffer) {
  if (-not $Buffer -or $Buffer.Length -eq 0) { return 0 }
  $sum = 0.0; $sumSq = 0.0; $min = 255; $max = 0
  foreach ($b in $Buffer) {
    $v = [double]$b; $sum += $v; $sumSq += ($v * $v)
    if ($b -lt $min) { $min = $b }
    if ($b -gt $max) { $max = $b }
  }
  $n = [double]$Buffer.Length
  $mean = $sum / $n
  $variance = [Math]::Max(0, ($sumSq / $n) - ($mean * $mean))
  $std = [Math]::Sqrt($variance)
  $contrast = [double]($max - $min)
  return [int][Math]::Round([Math]::Min(100, (($std / 64.0) * 55.0) + (($contrast / 255.0) * 45.0)))
}

function New-CaptureResult([byte[]]$Buffer) {
  $quality = Get-Quality $Buffer
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = ([BitConverter]::ToString($sha.ComputeHash($Buffer))).Replace("-", "").ToLowerInvariant() }
  finally { $sha.Dispose() }
  return @{
    ok = $true
    conectado = $true
    modo = $script:Modo
    largura = $script:ImageSize.nWidth
    altura = $script:ImageSize.nHeight
    bytes = $script:ImageSize.nImageSize
    qualidade = $quality
    qualidadeMinima = 70
    capturaAceita = ($quality -ge 70)
    imagemRawBase64 = [Convert]::ToBase64String($Buffer)
    capturaHash = $hash
    capturadoEm = (Get-Date).ToUniversalTime().ToString("o")
    mensagem = $(if ($quality -ge 70) { "Captura aceita." } else { "Qualidade abaixo de 70%. Repita a captura." })
  }
}

function Capture-Finger([int]$TimeoutMs = 15000, [bool]$ReturnSemDedo = $false) {
  if (-not (Open-Reader)) { throw $script:UltimoErro }
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
  do {
    $buffer = New-Object byte[] $script:ImageSize.nImageSize
    if ([FutronicNative]::ftrScanGetFrame($script:Handle, $buffer, [IntPtr]::Zero)) {
      return New-CaptureResult $buffer
    }
    Start-Sleep -Milliseconds 120
  } while ([DateTime]::UtcNow -lt $deadline)

  if ($ReturnSemDedo) {
    return @{ ok=$true; conectado=$true; modo=$script:Modo; semDedo=$true; mensagem="Aguardando digital." }
  }
  throw "Tempo esgotado aguardando o dedo no leitor."
}


function Read-JsonBody($Request) {
  try {
    if (-not $Request.HasEntityBody) { return @{} }
    $encoding = if ($Request.ContentEncoding) { $Request.ContentEncoding } else { [Text.Encoding]::UTF8 }
    $reader = New-Object IO.StreamReader($Request.InputStream, $encoding)
    try {
      $raw = $reader.ReadToEnd()
      if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
      return $raw | ConvertFrom-Json
    } finally {
      $reader.Dispose()
    }
  } catch {
    return @{}
  }
}

function Show-AccessPopup($Data) {
  $tipo = [string]($Data.tipo)
  $titulo = [string]($Data.titulo)
  $aluno = [string]($Data.alunoNome)
  $mensagem = [string]($Data.mensagem)

  if ([string]::IsNullOrWhiteSpace($titulo)) { $titulo = "Fusion Biometria" }

  $cor = [Drawing.Color]::FromArgb(37, 99, 235)
  if ($tipo -eq "liberado") { $cor = [Drawing.Color]::FromArgb(22, 163, 74) }
  elseif ($tipo -eq "bloqueado") { $cor = [Drawing.Color]::FromArgb(220, 38, 38) }
  elseif ($tipo -eq "nao_encontrada") { $cor = [Drawing.Color]::FromArgb(217, 119, 6) }

  $form = New-Object Windows.Forms.Form
  $form.FormBorderStyle = [Windows.Forms.FormBorderStyle]::None
  $form.StartPosition = [Windows.Forms.FormStartPosition]::Manual
  $form.TopMost = $true
  $form.ShowInTaskbar = $false
  $form.Width = 390
  $form.Height = 145
  $form.BackColor = [Drawing.Color]::White

  $area = [Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $form.Left = $area.Right - $form.Width - 18
  $form.Top = $area.Bottom - $form.Height - 18

  $faixa = New-Object Windows.Forms.Panel
  $faixa.Dock = [Windows.Forms.DockStyle]::Left
  $faixa.Width = 9
  $faixa.BackColor = $cor
  $form.Controls.Add($faixa)

  $lblTitulo = New-Object Windows.Forms.Label
  $lblTitulo.Left = 28; $lblTitulo.Top = 16; $lblTitulo.Width = 340; $lblTitulo.Height = 28
  $lblTitulo.Font = New-Object Drawing.Font("Segoe UI", 15, [Drawing.FontStyle]::Bold)
  $lblTitulo.ForeColor = $cor
  $lblTitulo.Text = $titulo
  $form.Controls.Add($lblTitulo)

  $lblAluno = New-Object Windows.Forms.Label
  $lblAluno.Left = 28; $lblAluno.Top = 50; $lblAluno.Width = 340; $lblAluno.Height = 25
  $lblAluno.Font = New-Object Drawing.Font("Segoe UI", 11, [Drawing.FontStyle]::Bold)
  $lblAluno.ForeColor = [Drawing.Color]::FromArgb(15, 23, 42)
  $lblAluno.Text = $aluno
  $form.Controls.Add($lblAluno)

  $lblMensagem = New-Object Windows.Forms.Label
  $lblMensagem.Left = 28; $lblMensagem.Top = 80; $lblMensagem.Width = 340; $lblMensagem.Height = 48
  $lblMensagem.Font = New-Object Drawing.Font("Segoe UI", 10)
  $lblMensagem.ForeColor = [Drawing.Color]::FromArgb(71, 85, 105)
  $lblMensagem.Text = $mensagem
  $form.Controls.Add($lblMensagem)

  $timer = New-Object Windows.Forms.Timer
  $timer.Interval = 2800
  $timer.Add_Tick({ $timer.Stop(); $form.Close() })
  $form.Add_Shown({ $timer.Start() })
  [void]$form.ShowDialog()
  $timer.Dispose()
  $form.Dispose()
}

function Send-Json($Context, [int]$Status, $Object) {
  if ($null -eq $Context -or $null -eq $Context.Response) { return }
  try {
    $json = $Object | ConvertTo-Json -Depth 10 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $response = $Context.Response
    $response.StatusCode = $Status
    $response.ContentType = "application/json; charset=utf-8"
    $response.Headers["Access-Control-Allow-Origin"] = "*"
    $response.Headers["Access-Control-Allow-Headers"] = "Content-Type"
    $response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    Write-Host "Falha ao responder HTTP: $($_.Exception.Message)" -ForegroundColor Yellow
  } finally {
    try { $Context.Response.OutputStream.Close() } catch {}
    try { $Context.Response.Close() } catch {}
  }
}

$listener = New-Object Net.HttpListener
$listener.Prefixes.Add($Base)
$listener.Start()
$null = Open-Reader
Write-Host "Fusion Biometria Local ativo em $Base | modo inicial: acesso" -ForegroundColor Green
Write-Host "Leitor aberto: $($script:Handle -ne [IntPtr]::Zero)"
Write-Host "O LED será mantido ativo pelas chamadas contínuas /capturar-acesso do Fusion ERP."
Write-Host "Pressione Ctrl+C para encerrar."

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $status = 200
    $body = @{ ok = $true }
    try {
      $path = $ctx.Request.Url.AbsolutePath.ToLowerInvariant()
      $method = $ctx.Request.HttpMethod.ToUpperInvariant()

      if ($method -eq "OPTIONS") {
        $body = @{ ok = $true }
      } elseif ($path -eq "/status" -and $method -eq "GET") {
        $aberto = Open-Reader
        $body = @{
          ok = $aberto; conectado = $aberto; modo = $script:Modo
          dispositivoAberto = ($script:Handle -ne [IntPtr]::Zero)
          leituraContinua = ($script:Modo -eq "acesso")
          largura = $(if ($script:ImageSize) { $script:ImageSize.nWidth } else { 0 })
          altura = $(if ($script:ImageSize) { $script:ImageSize.nHeight } else { 0 })
          bytes = $(if ($script:ImageSize) { $script:ImageSize.nImageSize } else { 0 })
          mensagem = $(if ($aberto) { "Futronic conectada. Modo $($script:Modo)." } else { $script:UltimoErro })
        }
        if (-not $aberto) { $status = 503 }
      } elseif (($path -eq "/modo-acesso" -or $path -eq "/modo/acesso") -and $method -eq "POST") {
        $script:Modo = "acesso"
        $null = Open-Reader
        $body = @{ ok=$true; modo=$script:Modo; conectado=($script:Handle -ne [IntPtr]::Zero); leituraContinua=$true }
      } elseif (($path -eq "/modo-cadastro" -or $path -eq "/modo/cadastro") -and $method -eq "POST") {
        $script:Modo = "cadastro"
        $null = Open-Reader
        $body = @{ ok=$true; modo=$script:Modo; conectado=($script:Handle -ne [IntPtr]::Zero); leituraContinua=$false }
      } elseif ($path -eq "/capturar-acesso" -and $method -eq "POST") {
        if ($script:Modo -ne "acesso") {
          $body = @{ ok=$true; pausado=$true; modo=$script:Modo; mensagem="Leitura de acesso pausada durante o cadastro." }
        } else {
          $body = Capture-Finger 1800 $true
        }
      } elseif ($path -eq "/capturar" -and $method -eq "POST") {
        if ($script:Modo -ne "cadastro") { $script:Modo = "cadastro" }
        $body = Capture-Finger 15000 $false
      } elseif ($path -eq "/notificar" -and $method -eq "POST") {
        $dadosNotificacao = Read-JsonBody $ctx.Request
        Show-AccessPopup $dadosNotificacao
        $body = @{ ok=$true; exibida=$true }
      } else {
        $status = 404
        $body = @{ ok=$false; mensagem="Rota não encontrada."; rota=$path }
      }
    } catch {
      $status = 500
      $body = @{ ok=$false; mensagem=$_.Exception.Message; modo=$script:Modo }
    }
    Send-Json $ctx $status $body
  }
} finally {
  Close-Reader
  try { $listener.Stop() } catch {}
  try { $listener.Close() } catch {}
}
