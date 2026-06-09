set app_path to path to me as string
set posix_app_path to POSIX path of app_path
set exec_path to posix_app_path & "Contents/Resources/bin/小猫Mock"
tell application "Terminal"
    activate
    do script (quoted form of exec_path)
end tell
