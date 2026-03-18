"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { shortenId } from "@/components/dashboard/dashboard-formatters";
import { listCategories } from "@/lib/categories";
import { humanizeUnknownError } from "@/lib/http-errors";
import { listWorkerProfiles, WorkerProfile } from "@/lib/worker-profile";

type MarketplaceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type DiscoveryTrustSummary = {
  availableCount: number;
  ratedCount: number;
  avgRating: string;
};

type UseMarketplaceDiscoveryResult = {
  discoveryLoading: boolean;
  discoveryMessage: string;
  discoverySearch: string;
  discoveryCategory: string;
  marketCategories: MarketplaceCategory[];
  featuredWorkers: WorkerProfile[];
  visibleCategories: MarketplaceCategory[];
  visibleWorkers: WorkerProfile[];
  trustSummary: DiscoveryTrustSummary;
  onDiscoverySearchChange: (value: string) => void;
  onToggleDiscoveryCategory: (categorySlug: string) => void;
  onResetDiscoveryFilters: () => void;
};

export function useMarketplaceDiscovery(): UseMarketplaceDiscoveryResult {
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryMessage, setDiscoveryMessage] = useState(
    "A carregar descoberta de serviços...",
  );
  const [discoverySearch, setDiscoverySearch] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState("");
  const [marketCategories, setMarketCategories] = useState<MarketplaceCategory[]>(
    [],
  );
  const [featuredWorkers, setFeaturedWorkers] = useState<WorkerProfile[]>([]);

  useEffect(() => {
    let isActive = true;

    async function loadDiscovery() {
      setDiscoveryLoading(true);
      setDiscoveryMessage("A carregar descoberta de serviços...");

      try {
        const [categories, workersResponse] = await Promise.all([
          listCategories(),
          listWorkerProfiles({
            isAvailable: true,
            sort: "rating:desc",
            page: 1,
            limit: 24,
          }),
        ]);

        if (!isActive) {
          return;
        }

        const activeCategories = categories
          .filter((item) => item.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .slice(0, 10)
          .map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            description: item.description,
          }));

        const topWorkers = [...workersResponse.data]
          .sort((a, b) => Number(b.ratingAvg) - Number(a.ratingAvg))
          .slice(0, 8);

        setMarketCategories(activeCategories);
        setFeaturedWorkers(topWorkers);
        setDiscoveryMessage(
          "Explora por categoria, reputação e disponibilidade para contratar com confiança.",
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        setDiscoveryMessage(
          humanizeUnknownError(
            error,
            "Descoberta indisponível agora. Usa o dashboard para continuar.",
          ),
        );
      } finally {
        if (isActive) {
          setDiscoveryLoading(false);
        }
      }
    }

    void loadDiscovery();

    return () => {
      isActive = false;
    };
  }, []);

  const normalizedSearch = discoverySearch.trim().toLowerCase();

  const visibleCategories = useMemo(() => {
    if (normalizedSearch.length === 0) {
      return marketCategories;
    }

    return marketCategories.filter((category) => {
      const description = category.description?.toLowerCase() ?? "";
      return (
        category.name.toLowerCase().includes(normalizedSearch) ||
        description.includes(normalizedSearch)
      );
    });
  }, [marketCategories, normalizedSearch]);

  const visibleWorkers = useMemo(() => {
    return featuredWorkers.filter((worker) => {
      if (
        discoveryCategory.length > 0 &&
        !worker.categories.some((item) => item.slug === discoveryCategory)
      ) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      const categoriesLabel = worker.categories
        .map((item) => item.name.toLowerCase())
        .join(" ");

      return (
        worker.location?.toLowerCase().includes(normalizedSearch) ||
        categoriesLabel.includes(normalizedSearch) ||
        worker.bio?.toLowerCase().includes(normalizedSearch) ||
        shortenId(worker.userId).toLowerCase().includes(normalizedSearch)
      );
    });
  }, [featuredWorkers, discoveryCategory, normalizedSearch]);

  const trustSummary = useMemo(() => {
    const availableCount = featuredWorkers.filter((worker) => worker.isAvailable)
      .length;
    const ratedCount = featuredWorkers.filter((worker) => worker.ratingCount > 0)
      .length;
    const avgRating =
      featuredWorkers.length > 0
        ? (
            featuredWorkers.reduce(
              (acc, worker) => acc + Number(worker.ratingAvg || 0),
              0,
            ) / featuredWorkers.length
          ).toFixed(1)
        : "0.0";

    return {
      availableCount,
      ratedCount,
      avgRating,
    };
  }, [featuredWorkers]);

  const handleToggleDiscoveryCategory = useCallback((categorySlug: string) => {
    setDiscoveryCategory((current) => (current === categorySlug ? "" : categorySlug));
  }, []);

  const handleResetDiscoveryFilters = useCallback(() => {
    setDiscoverySearch("");
    setDiscoveryCategory("");
  }, []);

  return {
    discoveryLoading,
    discoveryMessage,
    discoverySearch,
    discoveryCategory,
    marketCategories,
    featuredWorkers,
    visibleCategories,
    visibleWorkers,
    trustSummary,
    onDiscoverySearchChange: setDiscoverySearch,
    onToggleDiscoveryCategory: handleToggleDiscoveryCategory,
    onResetDiscoveryFilters: handleResetDiscoveryFilters,
  };
}
