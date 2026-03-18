import { FormEvent } from "react";
import { StatusTone } from "@/components/dashboard/dashboard-formatters";
import {
  DashboardActionPanel,
  DashboardBadge,
  DashboardEmptyState,
  DashboardMetaStat,
  DashboardPaginationRow,
  DashboardPanel,
  DashboardSectionHeader,
  DashboardSummaryCard,
} from "@/components/dashboard/ui/dashboard-primitives";
import { Category } from "@/lib/categories";

type CategorySortMode =
  | "sortOrder:asc"
  | "sortOrder:desc"
  | "name:asc"
  | "name:desc";

type CategoriesDomainSectionProps = {
  categoryStatus: string;
  getStatusTone: (message: string) => StatusTone;
  isAdmin: boolean;
  includeInactive: boolean;
  onIncludeInactiveChange: (checked: boolean) => void;
  categorySearch: string;
  onCategorySearchChange: (value: string) => void;
  categorySortMode: CategorySortMode;
  onCategorySortModeChange: (value: CategorySortMode) => void;
  categoryPageSize: number;
  onCategoryPageSizeChange: (value: number) => void;
  onReloadCategories: () => void;
  categoriesLoading: boolean;
  onCategoryPreviousPage: () => void;
  onCategoryNextPage: () => void;
  categoryPage: number;
  categoryPageCount: number;
  categoriesCount: number;
  totalActiveCategories: number;
  totalInactiveCategories: number;
  visibleCategories: Category[];
  totalFilteredCategories: number;
  onCreateCategory: (event: FormEvent<HTMLFormElement>) => void;
  categoryName: string;
  onCategoryNameChange: (value: string) => void;
  categorySlug: string;
  onCategorySlugChange: (value: string) => void;
  categoryDescription: string;
  onCategoryDescriptionChange: (value: string) => void;
  categorySortOrder: string;
  onCategorySortOrderChange: (value: string) => void;
  onDeactivateCategory: (categoryId: string) => void;
  formatDate: (value: string) => string;
};

export function CategoriesDomainSection({
  categoryStatus,
  getStatusTone,
  isAdmin,
  includeInactive,
  onIncludeInactiveChange,
  categorySearch,
  onCategorySearchChange,
  categorySortMode,
  onCategorySortModeChange,
  categoryPageSize,
  onCategoryPageSizeChange,
  onReloadCategories,
  categoriesLoading,
  onCategoryPreviousPage,
  onCategoryNextPage,
  categoryPage,
  categoryPageCount,
  categoriesCount,
  totalActiveCategories,
  totalInactiveCategories,
  visibleCategories,
  totalFilteredCategories,
  onCreateCategory,
  categoryName,
  onCategoryNameChange,
  categorySlug,
  onCategorySlugChange,
  categoryDescription,
  onCategoryDescriptionChange,
  categorySortOrder,
  onCategorySortOrderChange,
  onDeactivateCategory,
  formatDate,
}: CategoriesDomainSectionProps) {
  function handleResetCategoryFilters() {
    onCategorySearchChange("");
    onCategorySortModeChange("sortOrder:asc");
    onCategoryPageSizeChange(10);
    onIncludeInactiveChange(false);
  }

  return (
    <section id="categories" className="dashboard-section">
      <DashboardSectionHeader
        title="Categorias"
        subtitle="Categorias consistentes reduzem erros de criação de job e deixam o fluxo do cliente mais rápido."
        status={categoryStatus}
        statusTone={getStatusTone(categoryStatus)}
      />
      {!isAdmin ? (
        <p className="status">Modo leitura: gestão de categorias é exclusiva para ADMIN.</p>
      ) : null}

      <DashboardActionPanel
        title="Panorama de serviços"
        actions={
          <>
            <button
              type="button"
              onClick={onReloadCategories}
              disabled={categoriesLoading}
            >
              Recarregar categorias
            </button>
            <button type="button" onClick={handleResetCategoryFilters}>
              Limpar filtros
            </button>
          </>
        }
      >
        <div className="flow-summary">
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Total"
            value={categoriesCount}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Ativas"
            value={totalActiveCategories}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Inativas"
            value={totalInactiveCategories}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="No filtro atual"
            value={totalFilteredCategories}
          />
        </div>
      </DashboardActionPanel>

      <div className="section-toolbar">
        <label className="inline-check">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => onIncludeInactiveChange(event.target.checked)}
          />
          Incluir inativas
        </label>
        <label>
          Pesquisar
          <input
            type="search"
            value={categorySearch}
            onChange={(event) => onCategorySearchChange(event.target.value)}
            placeholder="Nome, slug ou descrição"
          />
        </label>
        <label>
          Ordenar
          <select
            value={categorySortMode}
            onChange={(event) =>
              onCategorySortModeChange(
                event.target.value as
                  | "sortOrder:asc"
                  | "sortOrder:desc"
                  | "name:asc"
                  | "name:desc",
              )
            }
          >
            <option value="sortOrder:asc">Ordem (asc)</option>
            <option value="sortOrder:desc">Ordem (desc)</option>
            <option value="name:asc">Nome (A-Z)</option>
            <option value="name:desc">Nome (Z-A)</option>
          </select>
        </label>
        <label>
          Itens/página
          <select
            value={String(categoryPageSize)}
            onChange={(event) => onCategoryPageSizeChange(Number(event.target.value))}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
        </label>
        <button type="button" onClick={onReloadCategories} disabled={categoriesLoading}>
          Recarregar
        </button>
      </div>

      <DashboardPaginationRow
        onPrevious={onCategoryPreviousPage}
        onNext={onCategoryNextPage}
        previousDisabled={categoryPage <= 1 || categoriesLoading}
        nextDisabled={categoryPage >= categoryPageCount || categoriesLoading}
      >
        <DashboardMetaStat label="Página" value={`${categoryPage}/${categoryPageCount}`} />
        <DashboardMetaStat
          label="Visíveis"
          value={`${visibleCategories.length}/${totalFilteredCategories}`}
        />
      </DashboardPaginationRow>

      <form onSubmit={onCreateCategory} className="form">
        <label>
          Nome
          <input
            type="text"
            value={categoryName}
            onChange={(event) => onCategoryNameChange(event.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label>
          Slug (opcional)
          <input
            type="text"
            value={categorySlug}
            onChange={(event) => onCategorySlugChange(event.target.value)}
            minLength={2}
            maxLength={80}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            title="Use apenas letras minúsculas, números e hífens."
          />
        </label>
        <label>
          Descrição (opcional)
          <input
            type="text"
            value={categoryDescription}
            onChange={(event) => onCategoryDescriptionChange(event.target.value)}
            maxLength={280}
          />
        </label>
        <label>
          Ordem
          <input
            type="number"
            value={categorySortOrder}
            onChange={(event) => onCategorySortOrderChange(event.target.value)}
            min={0}
            max={10000}
            step={1}
            required
          />
        </label>
        <button
          type="submit"
          className="primary"
          disabled={categoriesLoading || !isAdmin}
        >
          {categoriesLoading ? "Aguarda..." : "Criar categoria"}
        </button>
      </form>

      <DashboardPanel title="Catálogo de categorias">
        {categoriesLoading && categoriesCount === 0 ? (
          <p>A carregar categorias...</p>
        ) : totalFilteredCategories === 0 ? (
          <DashboardEmptyState
            message={
              categorySearch.trim().length > 0
                ? "Nenhuma categoria corresponde ao filtro atual."
                : "Ainda não tens categorias. Cria a primeira categoria para desbloquear perfis e jobs."
            }
            action={
              <button type="button" onClick={handleResetCategoryFilters}>
                Limpar filtros
              </button>
            }
          />
        ) : (
          visibleCategories.map((category) => (
            <article key={category.id} className="list-item">
              <p className="item-title">
                {category.name}
                <DashboardBadge tone={category.isActive ? "is-ok" : "is-muted"}>
                  {category.isActive ? "Ativa" : "Inativa"}
                </DashboardBadge>
              </p>
              <p>
                <strong>Slug:</strong> {category.slug}
              </p>
              {category.description ? <p>{category.description}</p> : null}
              <p>
                <strong>Ordem:</strong> {category.sortOrder}
              </p>
              <p>
                <strong>Atualizada:</strong> {formatDate(category.updatedAt)}
              </p>
              <button
                type="button"
                onClick={() => onDeactivateCategory(category.id)}
                disabled={categoriesLoading || !category.isActive || !isAdmin}
              >
                {category.isActive ? "Desativar categoria" : "Inativa"}
              </button>
            </article>
          ))
        )}
      </DashboardPanel>
    </section>
  );
}
