echo off

goto(){
# Linux code here
    node --inspect-brk "$(dirname $0)\bin\run" sfdmu:run %*
}

goto $@
exit

:(){
rem Windows script here
    node --inspect-brk "%~dp0\bin\run" sfdmu:run %*
exit

@echo off

