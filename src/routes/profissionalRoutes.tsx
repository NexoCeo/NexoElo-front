import SharedRoleRoutes from "./sharedRoleRoutes";

export default function ProfissionalRoutes() {
  return (
    <SharedRoleRoutes
      allowRegister={false}
      canManageFuncionamento={false}
      canManageServices={false}
      canViewReports={false}
      requireApprovedProfessional
    />
  );
}
