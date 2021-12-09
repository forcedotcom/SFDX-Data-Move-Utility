echo off

goto(){
# Linux code here
    node --inspect ./lib/sfdmu_run.js $*
}

goto $@
exit

:(){
rem Windows script here
    node --inspect ./lib/sfdmu_run.js  %*
exit

@echo off

