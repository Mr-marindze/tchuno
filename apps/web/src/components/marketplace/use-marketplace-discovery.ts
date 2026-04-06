"use client";

import { useEffect, useState } from "react";
import { listCategories } from "@/lib/categories";
import { humanizeUnknownError } from "@/lib/http-errors";
import { listWorkerProfiles, WorkerProfile } from "@/lib/worker-profile";

type MarketplaceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type UseMarketplaceDiscoveryResult = {
  discoveryLoading: boolean;
  discoveryMessage: string;
  marketCategories: MarketplaceCategory[];
  trustSummary: {
    totalCount: number;
    avgRating: string;
    responseEstimate: string;
  };
};

function getResponseEstimate(workers: WorkerProfile[]): string {
  const fastResponse = workers.some(
    (worker) =>
      worker.isAvailable &&
      (worker.ratingCount >= 10 || worker.experienceYears >= 8),
  );

  if (fastResponse) {
    return "~10 min";
  }

  const mediumResponse = workers.some(
    (worker) =>
      worker.isAvailable &&
      (worker.ratingCount >= 4 || worker.experienceYears >= 4),
  );

  if (mediumResponse) {
    return "~30 min";
  }

  return "Até 1h";
}

export function useMarketplaceDiscovery(): UseMarketplaceDiscoveryResult {
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryMessage, setDiscoveryMessage] = useState(
    "A carregar áreas do Tchuno...",
  );
  const [marketCategories, setMarketCategories] = useState<MarketplaceCategory[]>(
    [],
  );
  const [trustSummary, setTrustSummary] = useState({
    totalCount: 0,
    avgRating: "0.0",
    responseEstimate: "Até 1h",
  });

  useEffect(() => {
    let isActive = true;

    async function loadDiscovery() {
      setDiscoveryLoading(true);
      setDiscoveryMessage("A carregar áreas do Tchuno...");

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

        setMarketCategories(activeCategories);
        const ratedWorkers = workersResponse.data.filter(
          (worker) => Number(worker.ratingCount) > 0,
        );
        const avgRating =
          ratedWorkers.length > 0
            ? (
                ratedWorkers.reduce(
                  (acc, worker) => acc + Number(worker.ratingAvg || 0),
                  0,
                ) / ratedWorkers.length
              ).toFixed(1)
            : "0.0";

        setTrustSummary({
          totalCount:
            workersResponse.meta?.total ?? workersResponse.data.length,
          avgRating,
          responseEstimate: getResponseEstimate(workersResponse.data),
        });
        setDiscoveryMessage("Áreas disponíveis carregadas.");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setDiscoveryMessage(
          humanizeUnknownError(
            error,
            "Não foi possível carregar as áreas neste momento.",
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

  return {
    discoveryLoading,
    discoveryMessage,
    marketCategories,
    trustSummary,
  };
}
