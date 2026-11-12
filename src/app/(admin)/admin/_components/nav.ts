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

/** Dashboard sections, in page order. Ids are the anchors the sidebar links to. */
export const sections = [
  { id: "overview", label: "Overview", icon: LayoutGridIcon },
  { id: "funnel", label: "Conversion funnel", icon: FilterIcon },
  { id: "demand", label: "Demand vs supply", icon: BuildingIcon },
  { id: "location", label: "Live vs work", icon: MapPinIcon },
  { id: "pricing", label: "Price band gap", icon: BadgeDollarSignIcon },
  { id: "segments", label: "Buyer segments", icon: UsersIcon },
  { id: "worries", label: "Buyer worries", icon: MessageSquareWarningIcon },
  { id: "passes", label: "Why buyers pass", icon: ThumbsDownIcon },
  { id: "products", label: "Product performance", icon: BarChart3Icon },
  { id: "leads", label: "Leads", icon: InboxIcon },
  { id: "bank", label: "Bank eligibility", icon: LandmarkIcon },
] as const;
