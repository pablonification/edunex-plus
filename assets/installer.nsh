; Edunex Plus's own step in electron-builder's Windows installer (electron-builder.config.mjs,
; nsis.include).
;
; This installer installs for the Student's own Windows account, without asking anything. A copy
; that 0.1.0-alpha.1's step-by-step installer put there "only for me" it replaces where it is.
; That installer could also install for everyone on the computer, in Program Files, which this
; one can't remove without an administrator: rather than leave two copies side by side, it says
; what to do, opens Windows' list of apps, and stops.
!macro customInit
  Push $0
  ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $0 != ""
  ${andIf} ${FileExists} "$0\${APP_EXECUTABLE_FILENAME}"
    MessageBox MB_OK|MB_ICONINFORMATION "Edunex Plus versi uji yang lama terpasang untuk semua pengguna komputer ini. Copot dulu versi itu, lalu jalankan installer ini lagi. Datamu tetap tersimpan.$\r$\nKlik OK untuk membuka daftar aplikasi di Pengaturan Windows.$\r$\n$\r$\nAn older test version of Edunex Plus is installed for everyone on this computer. Uninstall it first, then run this installer again. Your data stays.$\r$\nClick OK to open the list of apps in Windows Settings." /SD IDOK
    ${ifNot} ${Silent}
      ExecShell "open" "ms-settings:appsfeatures"
    ${endIf}
    SetErrorLevel 2
    Quit
  ${endIf}
  Pop $0
!macroend
