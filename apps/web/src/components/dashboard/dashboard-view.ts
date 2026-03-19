export type DashboardView =
  | "home"
  | "jobs"
  | "workers"
  | "profile"
  | "reviews"
  | "categories"
  | "admin";

export function getDashboardTitle(view: DashboardView): string {
  switch (view) {
    case "home":
      return "Painel";
    case "jobs":
      return "Gestão de Jobs";
    case "workers":
      return "Descoberta de Profissionais";
    case "profile":
      return "Perfil e Sessões";
    case "reviews":
      return "Gestão de Reviews";
    case "categories":
      return "Gestão de Categorias";
    case "admin":
      return "Admin Ops";
    default:
      return "Dashboard";
  }
}

export function getDashboardSubtitle(view: DashboardView): string {
  if (view === "home") {
    return "Vê o que precisa da tua ação hoje.";
  }

  return "Área dedicada para reduzir ruído e focar na ação certa.";
}
