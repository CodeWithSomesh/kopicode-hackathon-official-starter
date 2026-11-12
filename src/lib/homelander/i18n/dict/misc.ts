import type { Dict } from "./types";

/**
 * Not-found page, Battle analysis copy (analysis.ts) and terms used on several L2 screens (lane L2).
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const misc: Dict = {
  "This page doesn't exist": "Alamak, page ni takde",
  "Back home": "Balik home",
  "Landed": "Landed",
  "High-rise": "High-rise",
  "Guarded-community fee": "Fee komuniti berpengawal",
  "Est. guard and landscaping fee": "Anggaran fee guard dan landskap",
  "Monthly": "Bulanan",
  "Money left each month after instalment, maintenance and commute": "Duit tinggal tiap bulan lepas instalmen, maintenance dan perjalanan",
  "Cash upfront": "Cash depan",
  "Down payment and fees against your savings": "Down payment dan fees berbanding simpanan you",
  "Commute": "Perjalanan ke office",
  "Hours a year getting to work (and your partner's)": "Jam setahun pergi kerja (dan partner you)",
  "Space": "Ruang",
  "Bedrooms against what you need, floor area, landed or high-rise": "Bilik tidur berbanding keperluan, luas lantai, landed atau high-rise",
  "Family": "Family",
  "Schools within your distance, parents, pets, room to grow": "Sekolah dalam jarak you, mak ayah, pet, ruang untuk membesar",
  "Value": "Nilai",
  "Price per sq ft against homes of the same type": "Harga per sq ft berbanding rumah jenis sama",
  "Ready": "Siap",
  "Years until the keys, against what you said is OK": "Berapa tahun sampai dapat kunci, berbanding apa you kata OK",
  "Lowest monthly cost": "Bayaran sebulan paling rendah",
  "What you pay every month counts most, then cash upfront.": "Apa you bayar tiap bulan paling penting, lepas tu cash depan.",
  "Shortest commute": "Perjalanan paling singkat",
  "Hours on the road or train count most.": "Jam atas jalan atau train paling penting.",
  "Most space / family": "Paling luas / family",
  "Bedrooms, floor area and schools count most.": "Bilik tidur, luas lantai dan sekolah paling penting.",
  "Best value": "Nilai terbaik",
  "Price per sq ft against similar homes counts most.": "Harga per sq ft berbanding rumah serupa paling penting.",
};
