"use client";

import Image, { type ImageProps } from "next/image";
import { pixelPhoto } from "@/lib/homelander/data";
import { useHomeLanderTheme } from "@/lib/homelander/theme";
import { PIXEL_THEMES } from "@/lib/homelander/theme-config";

/** A unit photo: pixelated in the 8-bit themes, the full photo everywhere else. */
export function UnitPhoto({
  photo,
  alt,
  ...props
}: Omit<ImageProps, "src"> & { photo: string }) {
  const theme = useHomeLanderTheme();
  return (
    <Image {...props} alt={alt} src={PIXEL_THEMES.includes(theme) ? pixelPhoto(photo) : photo} />
  );
}
