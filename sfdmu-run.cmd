echo off

goto(){
# Linux code here
    node ./lib/sfdmu_run.js $*
}

goto $@
exit

:(){
rem Windows script here
    node ./lib/sfdmu_run.js  %*
exit

@echo off

