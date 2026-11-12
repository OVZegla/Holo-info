@echo off
rem Lance la borne en plein ecran (mode kiosque Microsoft Edge), sans serveur.
rem Quitter : Alt+F4.
set "P=%~dp0index.html"
set "P=%P:\=/%"
start "" msedge --kiosk "file:///%P%" --edge-kiosk-type=fullscreen --no-first-run --disable-pinch --overscroll-history-navigation=0 --disable-features=TranslateUI
