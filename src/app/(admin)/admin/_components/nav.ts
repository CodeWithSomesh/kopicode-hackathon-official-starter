import {
  BadgeDollarSignIcon,
  BarChart3Icon,
  BuildingIcon,
  FilterIcon,
  InboxIcon,
  LandmarkIcon,
  LayoutGridIcon,
  MapPinIcon,
  MessageSquareWarningIcon,
  ThumbsDownIcon,
  UsersIcon,
} from "lucide-react";

/** i18n marker: the shell calls t(label) at render. */
const tr = (s: string) => s;

/** Dashboard sections, in page order. Ids are the anchors the sidebar links to. */
export const sections = [
  { id: "overview", label: tr("Overview"), icon: LayoutGridIcon },
  { id: "funnel", label: tr("Conversion funnel"), icon: FilterIcon },
  { id: "demand", label: tr("Demand vs supply"), icon: BuildingIcon },
  { id: "location", label: tr("Live vs work"), icon: MapPinIcon },
  { id: "pricing", label: tr("Price band gap"), icon: BadgeDollarSignIcon },
  { id: "segments", label: tr("Buyer segments"), icon: UsersIcon },
  { id: "worries", label: tr("Buyer worries"), icon: MessageSquareWarningIcon },
  { id: "passes", label: tr("Why buyers pass"), icon: ThumbsDownIcon },
  { id: "products", label: tr("Product performance"), icon: BarChart3Icon },
  { id: "leads", label: tr("Leads"), icon: InboxIcon },
  { id: "bank", label: tr("Bank eligibility"), icon: LandmarkIcon },
] as const;
