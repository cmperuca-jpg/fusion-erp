param([string]$ConfigPath = "$PSScriptRoot\agent.env")
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Log([string]$Message,[string]$Level="INFO"){
  $logDir=Join-Path $PSScriptRoot "logs"; New-Item -ItemType Directory -Force -Path $logDir|Out-Null
  $logPath=Join-Path $logDir "agent.log"
  if((Test-Path $logPath) -and (Get-Item $logPath).Length -gt 5242880){Move-Item -Force $logPath "$logPath.1"}
  $line="$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
  Add-Content -Path $logPath -Value $line -Encoding UTF8
}

function Read-EnvFile([string]$Path){
  if(-not(Test-Path $Path)){throw "Configuracao nao encontrada: $Path"}
  $map=@{}
  Get-Content $Path -Encoding UTF8|ForEach-Object{
    $line=$_.Trim()
    if(-not $line -or $line.StartsWith("#")){return}
    $parts=$line.Split("=",2)
    if($parts.Count -eq 2){$map[$parts[0].Trim()]=$parts[1].Trim()}
  }
  return $map
}

function Hex-ToBytes([string]$Hex){
  $clean=($Hex -replace '[^0-9A-Fa-f]','')
  if(-not $clean -or ($clean.Length%2)-ne 0){throw "HEX invalido"}
  $out=New-Object byte[] ($clean.Length/2)
  for($i=0;$i -lt $out.Length;$i++){$out[$i]=[Convert]::ToByte($clean.Substring($i*2,2),16)}
  return $out
}
function Bytes-ToHex([byte[]]$Bytes){
  if($null -eq $Bytes){return ""}
  return (($Bytes|ForEach-Object{$_.ToString("X2")}) -join "")
}
function Read-TcpResponse($Stream,[int]$QuietMs=150,[int]$MaxMs=3000){
  $bytes=New-Object System.Collections.Generic.List[byte]
  $buffer=New-Object byte[] 1024
  $started=[DateTime]::UtcNow;$last=[DateTime]::UtcNow
  while((([DateTime]::UtcNow-$started).TotalMilliseconds)-lt $MaxMs){
    if($Stream.DataAvailable){
      $count=$Stream.Read($buffer,0,$buffer.Length)
      if($count -gt 0){for($i=0;$i -lt $count;$i++){$bytes.Add($buffer[$i])};$last=[DateTime]::UtcNow}
    }elseif($bytes.Count -gt 0 -and (([DateTime]::UtcNow-$last).TotalMilliseconds)-ge $QuietMs){break}
    else{Start-Sleep -Milliseconds 25}
  }
  return $bytes.ToArray()
}
function Open-Tcp([string]$HostName,[int]$Port,[int]$TimeoutMs=5000){
  $client=New-Object System.Net.Sockets.TcpClient
  $task=$client.ConnectAsync($HostName,$Port)
  if(-not $task.Wait($TimeoutMs)){$client.Dispose();throw "Timeout conectando em $HostName`:$Port"}
  return $client
}

function Invoke-DriverHenry7x($Payload){
  $hostName=if($Payload.host){[string]$Payload.host}else{$script:HostName}
  $port=if($Payload.port){[int]$Payload.port}else{$script:Port}
  $client=Open-Tcp $hostName $port
  try{
    $stream=$client.GetStream();$stream.ReadTimeout=5000;$stream.WriteTimeout=5000
    $a=Hex-ToBytes "FE8A7100010100050000";$stream.Write($a,0,$a.Length);$stream.Flush()
    $r1=Read-TcpResponse $stream 130 2500
    Start-Sleep -Milliseconds 350
    $b=Hex-ToBytes "FE8671000201000A030506";$stream.Write($b,0,$b.Length);$stream.Flush()
    $r2=Read-TcpResponse $stream 130 2500
    $h1=Bytes-ToHex $r1;$h2=Bytes-ToHex $r2
    $ok=($h1 -eq "018A7100010000FB" -and $h2 -eq "01867100020000F4")
    return @{ok=$ok;driver="henry7x";host=$hostName;port=$port;confirmed=$ok;responses=@($h1,$h2)}
  }finally{$client.Close();$client.Dispose()}
}
function Invoke-DriverSimulator($Payload){
  Start-Sleep -Milliseconds 250
  return @{ok=$true;driver="simulador";simulated=$true;confirmed=$true}
}
function Invoke-DriverGenericTcp($Payload){
  $hex=[string]$script:Cfg["GENERIC_TCP_RELEASE_HEX"]
  if(-not $hex){throw "GENERIC_TCP_RELEASE_HEX nao configurado"}
  $hostName=if($Payload.host){[string]$Payload.host}else{$script:HostName}
  $port=if($Payload.port){[int]$Payload.port}else{$script:Port}
  $client=Open-Tcp $hostName $port
  try{
    $stream=$client.GetStream();$bytes=Hex-ToBytes $hex
    $stream.Write($bytes,0,$bytes.Length);$stream.Flush()
    $resp=Read-TcpResponse $stream 150 3000
    $received=Bytes-ToHex $resp
    $expected=[string]$script:Cfg["GENERIC_TCP_EXPECTED_RESPONSE_HEX"]
    $ok=if($expected){$received -eq ($expected -replace '[^0-9A-Fa-f]','').ToUpper()}else{$true}
    return @{ok=$ok;driver="generic_tcp";host=$hostName;port=$port;responseHex=$received;confirmed=$ok}
  }finally{$client.Close();$client.Dispose()}
}
function Invoke-SelectedDriver($Payload){
  switch($script:Driver){
    "henry7x"{return Invoke-DriverHenry7x $Payload}
    "simulador"{return Invoke-DriverSimulator $Payload}
    "generic_tcp"{return Invoke-DriverGenericTcp $Payload}
    "controlid"{throw "Driver Control iD preparado, mas requer API/SDK oficial."}
    "topdata"{throw "Driver TopData preparado, mas requer SDK/protocolo oficial."}
    "dimep"{throw "Driver Dimep preparado, mas requer SDK/protocolo oficial."}
    "tecnibra"{throw "Driver Tecnibra preparado, mas requer SDK/protocolo oficial."}
    "proveu"{throw "Driver Proveu preparado, mas requer SDK/protocolo oficial."}
    default{throw "Driver desconhecido: $script:Driver"}
  }
}

function Invoke-AgentApi([string]$Method,[string]$Path,$Body=$null){
  $headers=@{"x-agent-id"=$script:AgentId;"x-agent-token"=$script:Token}
  $p=@{Uri="$script:Server$Path";Method=$Method;Headers=$headers;TimeoutSec=20;UseBasicParsing=$true}
  if($null -ne $Body){$p["ContentType"]="application/json";$p["Body"]=($Body|ConvertTo-Json -Depth 20 -Compress)}
  return Invoke-RestMethod @p
}


try{
  $script:Cfg=Read-EnvFile $ConfigPath
  $script:AgentId=[string]$Cfg["ACCESS_AGENT_ID"]
  $script:Token=[string]$Cfg["ACCESS_AGENT_TOKEN"]
  $script:Server=([string]$Cfg["ACCESS_SERVER_URL"]).TrimEnd("/")
  $script:PollMs=[Math]::Max([int]$Cfg["ACCESS_AGENT_POLL_MS"],1000)
  $script:Driver=([string]$Cfg["ACCESS_DRIVER"]).ToLower()
  $script:HostName=[string]$Cfg["ACCESS_HOST"]
  $script:Port=[int]$Cfg["ACCESS_PORT"]
  if(-not $AgentId -or -not $Token -or -not $Server){throw "Configuracao incompleta"}
  Write-Log "Agente iniciado. ID=$AgentId Driver=$Driver Servidor=$Server"
  while($true){
    try{
      $next=Invoke-AgentApi "GET" "/api/access-bridge/agent/next"
      if($null -eq $next.command){Start-Sleep -Milliseconds $PollMs;continue}
      $cmd=$next.command;Write-Log "Comando recebido: $($cmd.id) driver=$Driver"
      try{
        if([string]$cmd.action -ne "release"){throw "Acao nao suportada: $($cmd.action)"}
        $result=Invoke-SelectedDriver $cmd.payload
        if(-not $result.ok){throw "Driver nao confirmou a liberacao"}
        Invoke-AgentApi "POST" "/api/access-bridge/agent/commands/$($cmd.id)/result" @{ok=$true;result=$result}|Out-Null
        Write-Log "Comando concluido: $($cmd.id)"
      }catch{
        $msg=$_.Exception.Message
        try{Invoke-AgentApi "POST" "/api/access-bridge/agent/commands/$($cmd.id)/result" @{ok=$false;error=$msg}|Out-Null}catch{}
        Write-Log "Comando falhou: $($cmd.id) - $msg" "ERROR"
      }
    }catch{
      Write-Log "Conexao falhou: $($_.Exception.Message)" "ERROR"
      Start-Sleep -Seconds 5
    }
  }
}catch{Write-Log $_.Exception.Message "FATAL";exit 1}
