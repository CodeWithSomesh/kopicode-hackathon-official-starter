#!/usr/bin/env bash
# One-off: download one official Gamuda Land photo per HomeLander unit, resize, and make the
# low-res pixel copy for the Arcade theme. Images © Gamuda Land, used with permission for an
# internal Gamuda hackathon (see docs/research/jodoh-data-sources.md, "Unit-level data and scraping terms").
# Run from the repo root:  bash scripts/fetch-gamuda-photos.sh
set -euo pipefail
S3="https://gamudaland.s3.ap-southeast-1.amazonaws.com/website"
OUT="public/homelander/gamuda"
PX="public/homelander/px/gamuda"
mkdir -p "$OUT" "$PX"

# unit id | image URL | official page
LIST=$(cat <<'LIST'
cove-north-woods|S3/North_Woods_Main_Image_0d1793594d.jpg|https://www.gamudaland.com.my/developments/township/north-woods
cove-mori-pines|S3/Mori_Pines_Main_Image_6a0545c9bd.jpg|https://www.gamudaland.com.my/developments/township/mori-pines
cove-camellia|S3/The_Camellia_Main_Image_03959b1213.jpg|https://www.gamudaland.com.my/developments/township/the-camellia
gardens-illaria|S3/Illaria_Main_Image_18979d416a.jpg|https://www.gamudaland.com.my/developments/township/illaria-hillside-homes
gardens-valeria|S3/Valeria_Main_Image_adb5d95f4a.jpg|https://www.gamudaland.com.my/developments/township/valeria-garden-homes
gardens-heston-hills|S3/Heston_Hills_Main_Image_5a3f2fc81c.jpg|https://www.gamudaland.com.my/developments/township/heston-hills
gardens-park-astor|S3/Astor_Main_Image_050824_New_c35c913589.jpg|https://www.gamudaland.com.my/developments/township/astor
gardens-park-elgar|S3/Elgar_Main_Image_98f16bc1d8.jpg|https://www.gamudaland.com.my/developments/township/elgar
tf7-quayside-plazas|S3/Quayside_Plazas_Serviced_Apartment_Main_Image_f54d06e922.jpg|https://www.gamudaland.com.my/developments/township/quayside-plazas-serviced-apartments
tf7-clove-signature|S3/The_Clove_Signature_Main_Image_130326_734e0db604.jpg|https://www.gamudaland.com.my/developments/township/the-clove-signature
jade-j-homes|S3/J_Homes_Main_Image_b2b59b1c34.jpg|https://www.gamudaland.com.my/developments/township/j-homes
jade-summerwoods|S3/Summerwoods_Main_Image_0b2d58cd77.jpg|https://www.gamudaland.com.my/developments/township/summerwoods
kundang-valerian|S3/Valerian_Main_Image_bbc6ae7119.jpg|https://www.gamudaland.com.my/developments/township/valerian
kundang-anise|S3/Anise_Main_Image_d308108cec.jpeg|https://www.gamudaland.com.my/developments/township/anise
haus15-type-a|https://www.gamudaland.com.my/images/hauson15/facade.jpg|https://www.gamudaland.com.my/developments/haus-on-15
haus15-type-e|https://www.gamudaland.com.my/images/hauson15/living.jpg|https://www.gamudaland.com.my/developments/haus-on-15
horizon-greenville|S3/Green_Ville_Main_Image_bb5ff714ff.jpg|https://www.gamudaland.com.my/developments/township/green-ville
horizon-kingswood|S3/Kings_Wood_Main_Image_406a628ca1.jpg|https://www.gamudaland.com.my/developments/township/kings-wood
horizon-the-peak|S3/The_Peak_Main_Image_7b08b2c498.jpg|https://www.gamudaland.com.my/developments/township/the-peak
bantayan-dilenia|S3/BBR_Main_Image_087a4fd768.jpg|https://www.gamudaland.com.my/developments/township/dilenia
bantayan-cemara|S3/BBR_Banner_d0aa0ec50d.jpg|https://www.gamudaland.com.my/developments/bukit-bantayan
highpark-suites|S3/HPS_Banner_92892f87f2.jpg|https://www.gamudaland.com.my/developments/township/high-park-suites
robertson-residences|S3/The_Robertson_Thumbnail_1c33f5a571.jpg|https://www.gamudaland.com.my/developments/township/the-robertson
madge-mansions|S3/Madge_Mansions_Banner_0667ef7a83.jpg|https://www.gamudaland.com.my/developments/township/madge-mansions
valencia-semi-d|S3/Valencia_Banner_ab14937857.jpg|https://www.gamudaland.com.my/developments/valencia
botanic-terrace|S3/Bandar_Botanic_Banner_582f118e3d.jpg|https://www.gamudaland.com.my/developments/bandar-botanic
kemuning-terrace|S3/Kota_Kemuning_Banner_2bf9dbbb7d.jpg|https://www.gamudaland.com.my/developments/kota-kemuning
LIST
)

TMP=$(mktemp -d)
while IFS='|' read -r id url page; do
  [ -z "$id" ] && continue
  url="${url/S3/$S3}"
  ext="${url##*.}"
  if curl -sSfL -A "Mozilla/5.0" -o "$TMP/$id.$ext" "$url"; then
    sips -s format jpeg -s formatOptions 82 -Z 1600 "$TMP/$id.$ext" --out "$OUT/$id.jpg" >/dev/null
    sips -Z 120 -s format png "$OUT/$id.jpg" --out "$PX/$id.png" >/dev/null
    echo "ok   $id"
  else
    echo "FAIL $id ($url)"
  fi
  echo "$id|$url|$page" >> "$TMP/manifest.txt"
done <<< "$LIST"
cp "$TMP/manifest.txt" "${MANIFEST:-/dev/null}" 2>/dev/null || true
rm -rf "$TMP"
