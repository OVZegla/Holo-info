@echo off
rem Apercu dans une fenetre au format portrait (540 x 960), pour tester sur un PC.
rem Camera et micro autorises sans question, voix sans toucher prealable.
set "P=%~dp0index.html"
set "P=%P:\=/%"
start "" msedge --app="file:///%P%" --window-size=560,1000 --no-first-run --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required
