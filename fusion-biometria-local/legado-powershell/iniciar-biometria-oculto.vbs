Option Explicit
Dim shell, fso, base, watchdog
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
watchdog = base & "\FusionBiometriaWatchdog.vbs"
shell.Run "wscript.exe """ & watchdog & """", 0, False
