Option Explicit
Dim shell, fso, base, ps1, command, rc
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = base & "\FusionBiometriaLocal.ps1"

Do
  command = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
  rc = shell.Run(command, 0, True)
  WScript.Sleep 3000
Loop
