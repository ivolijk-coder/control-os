import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CreditCard,
  ChevronsLeft,
  ChevronsRight,
  Command,
  FileText,
  FolderKanban,
  Gauge,
  Landmark,
  Layers3,
  LayoutGrid,
  LogOut,
  Menu,
  NotebookText,
  Plane,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Target,
  Trophy,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { IconName } from '@control-os/types';

/**
 * Mapa central de ícones. A Sidebar e outros componentes referenciam ícones
 * por nome (`IconName`) nos dados mockados/futuros dados de API — este mapa
 * resolve o nome para o componente real do lucide-react.
 *
 * Tipado como `Record<IconName, LucideIcon>` (chave é a união literal
 * `IconName`, não `string`) para que o TypeScript resolva o acesso como
 * propriedade conhecida — garantindo em tempo de compilação que todo
 * `IconName` tem um ícone correspondente, e que `ICON_MAP[nome]` nunca é
 * `undefined` mesmo com `noUncheckedIndexedAccess` ativo. Se um nome for
 * adicionado a `IconName` (em `packages/types`) sem entrada aqui, o `satisfies`
 * abaixo falha a build — não é possível esquecer um ícone silenciosamente.
 */
export const ICON_MAP = {
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
  Menu,
  CalendarClock,
  Trophy,
  Repeat,
  Landmark,
  Plane,
  NotebookText,
  Gauge,
  ArrowLeftRight,
  CreditCard,
  Layers3,
  BarChart3,
} satisfies Record<IconName, LucideIcon>;
