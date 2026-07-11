import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  Command,
  FileText,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Mapa central de ícones. A Sidebar e outros componentes referenciam ícones
 * por nome (string) nos dados mockados/futuros dados de API — este mapa
 * resolve o nome para o componente real do lucide-react.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutGrid,
  Sparkles,
  Activity,
  Target,
  FolderKanban,
  FileText,
  BookOpen,
  Wallet,
  User,
  Building2,
  Users,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Bell,
  Command,
  Plus,
  LogOut,
  Settings,
};
