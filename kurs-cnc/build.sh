#!/bin/sh
# Wraps kurs.html (artifact body) into a standalone page for GitHub Pages.
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n</head>\n<body>\n'; cat kurs.html; printf '\n</body>\n</html>\n'; } > index.html
