#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

if [ -f "sheet1.jpg" ] || [ -f "sheet1.png" ]; then
  S1=$( [ -f "sheet1.jpg" ] && echo "sheet1.jpg" || echo "sheet1.png" )
  swift scripts/slice_portrait_sheet.swift "$S1" tariel avtandil tinatin nestan nestan_alt pridon rostevan rustaveli
fi

if [ -f "sheet2.jpg" ] || [ -f "sheet2.png" ]; then
  S2=$( [ -f "sheet2.jpg" ] && echo "sheet2.jpg" || echo "sheet2.png" )
  swift scripts/slice_portrait_sheet.swift "$S2" asmat parsadan saridan davari ramaz fatman dulardukht usen
fi

if [ -f "sheet3.jpg" ] || [ -f "sheet3.png" ]; then
  S3=$( [ -f "sheet3.jpg" ] && echo "sheet3.jpg" || echo "sheet3.png" )
  swift scripts/slice_portrait_sheet.swift "$S3" shermadin sograt khvarazmsha chashnagiri surkhavi rosan tariel_alt avtandil_alt
fi

rm -f assets/characters/*_alt.png
echo "✅ All 21 character portraits sliced into assets/characters/*.png!"
