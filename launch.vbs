Dim fso, batPath, shell
Set fso = CreateObject("Scripting.FileSystemObject")
batPath = fso.GetParentFolderName(WScript.ScriptFullName) & "\run.bat"
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd.exe /k """ & batPath & """", 1, False
