echo off

goto(){
# Linux code here
    node --inspect "bin/run" sfdmu:run $*
}

goto $@
exit

:(){
rem Windows script here
    node --inspect "%~dp0\bin\run" sfdmu:run %*
exit

@echo off

