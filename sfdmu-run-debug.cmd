echo off

goto(){
# Linux code here
    node --inspect "bin/run.js" sfdmu:run $*
}

goto $@
exit

:(){
rem Windows script here
    node --inspect "%~dp0bin\\run.js" sfdmu:run %*
exit

@echo off
