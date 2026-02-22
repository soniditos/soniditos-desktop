; NSIS include para electron-builder
; Crea accesos directos en el menú Inicio y en la carpeta Startup del usuario

!macro customInstall
  ; Crear carpeta en Start Menu y acceso directo dentro
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\\${PRODUCT_FILENAME}.exe" 0

  ; Crear acceso directo en la carpeta Startup para inicio automático
  CreateShortCut "$SMPROGRAMS\Startup\${PRODUCT_NAME}.lnk" "$INSTDIR\\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\\${PRODUCT_FILENAME}.exe" 0
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$SMPROGRAMS\Startup\${PRODUCT_NAME}.lnk"
!macroend
