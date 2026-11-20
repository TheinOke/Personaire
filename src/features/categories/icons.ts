import {
  BookOpen,
  Briefcase,
  Brain,
  Dumbbell,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  Leaf,
  Music,
  Palette,
  Plane,
  Smile,
  Sparkles,
  Tag,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/** Icons available for categories. Keys are stored in categories.icon. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  wallet: Wallet,
  user: User,
  users: Users,
  heart: Heart,
  dumbbell: Dumbbell,
  'book-open': BookOpen,
  brain: Brain,
  house: House,
  leaf: Leaf,
  music: Music,
  palette: Palette,
  plane: Plane,
  smile: Smile,
  sparkles: Sparkles,
  tag: Tag,
}

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Tag
}
