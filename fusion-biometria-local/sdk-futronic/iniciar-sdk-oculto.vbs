Option Explicit
Dim shell, fso, base, exe
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
exe = base & "\FusionBiometriaSdk.exe"
shell.CurrentDirectory = base
shell.Run """" & exe & """", 0, False
