@echo off
cd /d "d:\User\70641\Documents\SCE Projects\game_entry_0\tools\sprite"
del "_pkg_status.log" 2>nul
echo START %date% %time%> "_pkg_status.log"
call npm run build > "_pkg_build.log" 2>&1
echo BUILD_EXIT=%errorlevel%>> "_pkg_status.log"
call npm run package:desktop:win > "_pkg_pack.log" 2>&1
echo PACK_EXIT=%errorlevel%>> "_pkg_status.log"
echo ALL_DONE %date% %time%>> "_pkg_status.log"
