!include "nsDialogs.nsh"
!include "MUI2.nsh"

!ifndef BUILD_UNINSTALLER
  !macro customPageAfterChangeDir
    Page custom StoragePageShow
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW InstallationProgressShow
  !macroend

  Function StoragePageShow
    !insertmacro MUI_HEADER_TEXT "Storage required" "Review the space needed before installation."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    !ifdef APP_64_UNPACKED_SIZE
      IntOp $1 ${APP_64_UNPACKED_SIZE} + 1023
      IntOp $1 $1 / 1024
    !else
      StrCpy $1 "unknown"
    !endif
    ${NSD_CreateLabel} 0 8u 100% 30u "Installed app: approximately $1 MB"
    Pop $0
    ${NSD_CreateLabel} 0 42u 100% 45u "Setup also needs temporary free space while extracting files. Songs, Bible translations, and other user data require additional space."
    Pop $0
    ${NSD_CreateLabel} 0 98u 100% 35u "On the next screen, the progress bar shows installation activity. Please keep this window open until setup finishes."
    Pop $0
    nsDialogs::Show
  FunctionEnd

  Function InstallationProgressShow
    !insertmacro MUI_HEADER_TEXT "Installing Worship Studio" "The progress bar shows installation activity. Please wait until setup finishes."
  FunctionEnd
!endif
