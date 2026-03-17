"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AuthResponse,
  clearTokens,
  DeviceSession,
  ensureSession,
  getOrCreateDeviceId,
  getStoredTokens,
  listSessions,
  logout,
  logoutAll,
  refresh,
  revokeSession,
  saveTokens,
  SessionListMeta,
  SessionListQuery,
  startAutoRefresh,
} from "@/lib/auth";
import {
  Category,
  createCategory,
  deactivateCategory,
  listCategories,
} from "@/lib/categories";
import {
  getMyWorkerProfile,
  listWorkerProfiles,
  upsertMyWorkerProfile,
  WorkerProfile,
} from "@/lib/worker-profile";
import {
  createJob,
  Job,
  JobStatus,
  listMyClientJobs,
  listMyWorkerJobs,
  updateJobStatus,
} from "@/lib/jobs";
import {
  createReview,
  listMyReviews,
  listWorkerReviews,
  Review,
} from "@/lib/reviews";
import { ToastTone, useToast } from "@/components/toast-provider";
import { humanizeUnknownError } from "@/lib/http-errors";

type DashboardState = {
  me: unknown;
  auth: AuthResponse;
};

const jobStatuses: JobStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
];

type StatusTone = "loading" | "success" | "error";

function getWorkerAllowedTransitions(status: JobStatus): JobStatus[] {
  if (status === "REQUESTED") {
    return ["ACCEPTED"];
  }

  if (status === "ACCEPTED") {
    return ["IN_PROGRESS"];
  }

  if (status === "IN_PROGRESS") {
    return ["COMPLETED"];
  }

  return [];
}

function getStatusTone(message: string): StatusTone {
  const text = message.trim().toLowerCase();

  if (text.startsWith("a ")) {
    return "loading";
  }

  if (
    text.includes("erro") ||
    text.includes("falha") ||
    text.includes("invál") ||
    text.includes("inval")
  ) {
    return "error";
  }

  return "success";
}

function getToastToneFromStatus(message: string): ToastTone | null {
  const text = message.trim().toLowerCase();
  if (text.length === 0) {
    return null;
  }

  if (text.startsWith("a ") || text.startsWith("pronto para")) {
    return null;
  }

  if (
    text === "sessão ativa." ||
    text === "perfil profissional não carregado." ||
    text.includes("carregado.") ||
    text.includes("carregados.") ||
    text.includes("recarregad")
  ) {
    return null;
  }

  if (
    text.includes("erro") ||
    text.includes("falha") ||
    text.includes("invál") ||
    text.includes("inval") ||
    text.includes("ausente") ||
    text.includes("não tens") ||
    text.includes("nao tens") ||
    text.includes("deve") ||
    text.includes("seleciona") ||
    text.includes("não foi possível") ||
    text.includes("nao foi possivel")
  ) {
    return "error";
  }

  if (
    text.includes("sucesso") ||
    text.includes("terminad") ||
    text.includes("revogad") ||
    text.includes("desativad") ||
    text.includes("atualizad") ||
    text.includes("guardad") ||
    text.includes("criad")
  ) {
    return "success";
  }

  return null;
}

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat("pt-MZ", {
    style: "currency",
    currency: "MZN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRatingValue(rating: number | string): string {
  const parsed = typeof rating === "number" ? rating : Number(rating);
  if (Number.isNaN(parsed)) {
    return "0.0";
  }

  return parsed.toFixed(1);
}

function formatStars(rating: number | string): string {
  const parsed = typeof rating === "number" ? rating : Number(rating);
  if (Number.isNaN(parsed)) {
    return "☆☆☆☆☆";
  }

  const rounded = Math.max(0, Math.min(5, Math.round(parsed)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function shortenId(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const lastToastByChannelRef = useRef<Record<string, string>>({});
  const currentDeviceId = useMemo(() => getOrCreateDeviceId(), []);
  const [state, setState] = useState<DashboardState | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [sessionsMeta, setSessionsMeta] = useState<SessionListMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<SessionListQuery["status"]>("active");
  const [sort, setSort] = useState<SessionListQuery["sort"]>("lastUsedAt:desc");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("A validar sessão...");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStatus, setCategoryStatus] = useState(
    "Pronto para gerir categorias.",
  );
  const [includeInactive, setIncludeInactive] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categorySortOrder, setCategorySortOrder] = useState("0");
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySortMode, setCategorySortMode] = useState<
    "sortOrder:asc" | "sortOrder:desc" | "name:asc" | "name:desc"
  >("sortOrder:asc");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [workerProfileStatus, setWorkerProfileStatus] = useState(
    "Perfil profissional não carregado.",
  );
  const [workerProfileLoading, setWorkerProfileLoading] = useState(false);
  const [profileBio, setProfileBio] = useState("");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileHourlyRate, setProfileHourlyRate] = useState("");
  const [profileExperienceYears, setProfileExperienceYears] = useState("0");
  const [profileIsAvailable, setProfileIsAvailable] = useState(true);
  const [profileCategoryIds, setProfileCategoryIds] = useState<string[]>([]);
  const [workerProfiles, setWorkerProfiles] = useState<WorkerProfile[]>([]);
  const [workerProfilesStatus, setWorkerProfilesStatus] = useState(
    "Pronto para procurar profissionais.",
  );
  const [workerProfilesLoading, setWorkerProfilesLoading] = useState(false);
  const [workerCategorySlugFilter, setWorkerCategorySlugFilter] = useState("");
  const [workerAvailabilityFilter, setWorkerAvailabilityFilter] = useState<
    "all" | "true" | "false"
  >("all");
  const [workerLimit, setWorkerLimit] = useState(10);
  const [workerOffset, setWorkerOffset] = useState(0);
  const [workerSortMode, setWorkerSortMode] = useState<
    "updatedAt:desc" | "rating:desc" | "hourlyRate:asc" | "hourlyRate:desc"
  >("updatedAt:desc");
  const [workerSearch, setWorkerSearch] = useState("");
  const [jobsStatus, setJobsStatus] = useState("Pronto para gerir jobs.");
  const [jobsLoading, setJobsLoading] = useState(false);
  const [clientJobs, setClientJobs] = useState<Job[]>([]);
  const [workerJobs, setWorkerJobs] = useState<Job[]>([]);
  const [jobStatusFilter, setJobStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [jobLimit, setJobLimit] = useState(10);
  const [jobOffset, setJobOffset] = useState(0);
  const [jobWorkerOptions, setJobWorkerOptions] = useState<WorkerProfile[]>([]);
  const [jobWorkerProfileId, setJobWorkerProfileId] = useState("");
  const [jobCategoryId, setJobCategoryId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobBudget, setJobBudget] = useState("");
  const [jobScheduledFor, setJobScheduledFor] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [jobSortMode, setJobSortMode] = useState<
    "createdAt:desc" | "budget:asc" | "budget:desc"
  >("createdAt:desc");
  const [reviewsStatus, setReviewsStatus] = useState("Pronto para gerir reviews.");
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [workerReviews, setWorkerReviews] = useState<Review[]>([]);
  const [reviewWorkerOptions, setReviewWorkerOptions] = useState<WorkerProfile[]>([]);
  const [reviewWorkerProfileId, setReviewWorkerProfileId] = useState("");
  const [completedClientJobs, setCompletedClientJobs] = useState<Job[]>([]);
  const [reviewJobId, setReviewJobId] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSortMode, setReviewSortMode] = useState<
    "createdAt:desc" | "rating:desc" | "rating:asc"
  >("createdAt:desc");
  const [reviewRatingFilter, setReviewRatingFilter] = useState<
    "all" | "5" | "4" | "3" | "2" | "1"
  >("all");
  const [loading, setLoading] = useState(true);
  const isAuthenticated = Boolean(state?.auth.accessToken);
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  );
  const selectedJobWorkerProfile = useMemo(
    () => jobWorkerOptions.find((profile) => profile.id === jobWorkerProfileId) ?? null,
    [jobWorkerOptions, jobWorkerProfileId],
  );
  const availableJobCategories = useMemo(() => {
    if (!selectedJobWorkerProfile) {
      return activeCategories;
    }

    const allowed = new Set(
      selectedJobWorkerProfile.categories.map((category) => category.id),
    );
    return activeCategories.filter((category) => allowed.has(category.id));
  }, [activeCategories, selectedJobWorkerProfile]);
  const reviewedJobIds = useMemo(
    () => new Set(myReviews.map((review) => review.jobId)),
    [myReviews],
  );
  const reviewableJobs = useMemo(
    () =>
      completedClientJobs.filter((job) => {
        if (reviewedJobIds.has(job.id)) {
          return false;
        }

        return true;
      }),
    [completedClientJobs, reviewedJobIds],
  );
  const filteredSortedCategories = useMemo(() => {
    const search = categorySearch.trim().toLowerCase();
    const data = categories
      .filter((category) => {
        if (!search) {
          return true;
        }

        return (
          category.name.toLowerCase().includes(search) ||
          category.slug.toLowerCase().includes(search) ||
          (category.description ?? "").toLowerCase().includes(search)
        );
      })
      .slice();

    data.sort((a, b) => {
      if (categorySortMode === "name:asc") {
        return a.name.localeCompare(b.name);
      }

      if (categorySortMode === "name:desc") {
        return b.name.localeCompare(a.name);
      }

      if (categorySortMode === "sortOrder:desc") {
        return b.sortOrder - a.sortOrder;
      }

      return a.sortOrder - b.sortOrder;
    });

    return data;
  }, [categories, categorySearch, categorySortMode]);
  const categoryPageCount = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(filteredSortedCategories.length / Math.max(1, categoryPageSize)),
      ),
    [filteredSortedCategories.length, categoryPageSize],
  );
  const visibleCategories = useMemo(() => {
    const safePage = Math.min(categoryPage, categoryPageCount);
    const safePageSize = Math.max(1, categoryPageSize);
    const start = (safePage - 1) * safePageSize;
    return filteredSortedCategories.slice(start, start + safePageSize);
  }, [
    categoryPage,
    categoryPageCount,
    categoryPageSize,
    filteredSortedCategories,
  ]);
  const visibleWorkerProfiles = useMemo(() => {
    const search = workerSearch.trim().toLowerCase();
    const data = workerProfiles
      .filter((profile) => {
        if (!search) {
          return true;
        }

        return (
          profile.userId.toLowerCase().includes(search) ||
          (profile.location ?? "").toLowerCase().includes(search) ||
          profile.categories.some((item) =>
            item.name.toLowerCase().includes(search),
          )
        );
      })
      .slice();

    data.sort((a, b) => {
      if (workerSortMode === "rating:desc") {
        return Number(b.ratingAvg) - Number(a.ratingAvg);
      }

      if (workerSortMode === "hourlyRate:asc") {
        const left = a.hourlyRate ?? Number.MAX_SAFE_INTEGER;
        const right = b.hourlyRate ?? Number.MAX_SAFE_INTEGER;
        return left - right;
      }

      if (workerSortMode === "hourlyRate:desc") {
        const left = a.hourlyRate ?? -1;
        const right = b.hourlyRate ?? -1;
        return right - left;
      }

      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });

    return data;
  }, [workerProfiles, workerSearch, workerSortMode]);
  const visibleClientJobs = useMemo(() => {
    const search = jobSearch.trim().toLowerCase();
    const data = clientJobs
      .filter((job) => {
        if (!search) {
          return true;
        }

        return (
          job.title.toLowerCase().includes(search) ||
          job.description.toLowerCase().includes(search)
        );
      })
      .slice();

    data.sort((a, b) => {
      if (jobSortMode === "budget:asc") {
        return a.budget - b.budget;
      }

      if (jobSortMode === "budget:desc") {
        return b.budget - a.budget;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return data;
  }, [clientJobs, jobSearch, jobSortMode]);
  const visibleWorkerJobs = useMemo(() => {
    const search = jobSearch.trim().toLowerCase();
    const data = workerJobs
      .filter((job) => {
        if (!search) {
          return true;
        }

        return (
          job.title.toLowerCase().includes(search) ||
          job.description.toLowerCase().includes(search)
        );
      })
      .slice();

    data.sort((a, b) => {
      if (jobSortMode === "budget:asc") {
        return a.budget - b.budget;
      }

      if (jobSortMode === "budget:desc") {
        return b.budget - a.budget;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return data;
  }, [workerJobs, jobSearch, jobSortMode]);
  const visibleMyReviews = useMemo(() => {
    const data = myReviews
      .filter((review) => {
        if (reviewRatingFilter === "all") {
          return true;
        }

        return review.rating === Number(reviewRatingFilter);
      })
      .slice();

    data.sort((a, b) => {
      if (reviewSortMode === "rating:asc") {
        return a.rating - b.rating;
      }

      if (reviewSortMode === "rating:desc") {
        return b.rating - a.rating;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return data;
  }, [myReviews, reviewRatingFilter, reviewSortMode]);
  const visibleWorkerReviews = useMemo(() => {
    const data = workerReviews
      .filter((review) => {
        if (reviewRatingFilter === "all") {
          return true;
        }

        return review.rating === Number(reviewRatingFilter);
      })
      .slice();

    data.sort((a, b) => {
      if (reviewSortMode === "rating:asc") {
        return a.rating - b.rating;
      }

      if (reviewSortMode === "rating:desc") {
        return b.rating - a.rating;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return data;
  }, [reviewRatingFilter, reviewSortMode, workerReviews]);
  const activeSessionCount = useMemo(
    () => sessions.filter((session) => !session.revokedAt).length,
    [sessions],
  );
  const myCompletedJobsCount = useMemo(
    () => clientJobs.filter((job) => job.status === "COMPLETED").length,
    [clientJobs],
  );
  const selectedWorkerReviewAverage = useMemo(() => {
    if (visibleWorkerReviews.length === 0) {
      return "0.0";
    }

    const total = visibleWorkerReviews.reduce(
      (sum, review) => sum + review.rating,
      0,
    );
    return (total / visibleWorkerReviews.length).toFixed(1);
  }, [visibleWorkerReviews]);
  const jobCreationChecklist = useMemo(
    () => [
      {
        label: "Categorias ativas criadas",
        ready: activeCategories.length > 0,
        help: "Cria pelo menos uma categoria para permitir matching.",
      },
      {
        label: "Profissionais disponíveis",
        ready: jobWorkerOptions.length > 0,
        help: "Um worker precisa de perfil ativo e disponibilidade.",
      },
      {
        label: "Categoria compatível com o worker",
        ready: availableJobCategories.length > 0,
        help: "Escolhe um worker com categoria compatível com o pedido.",
      },
    ],
    [activeCategories.length, availableJobCategories.length, jobWorkerOptions.length],
  );

  const pushStatusToast = useCallback(
    (channel: string, message: string) => {
      const tone = getToastToneFromStatus(message);
      if (!tone) {
        return;
      }

      const normalized = message.trim();
      if (lastToastByChannelRef.current[channel] === normalized) {
        return;
      }

      lastToastByChannelRef.current[channel] = normalized;
      pushToast({ message: normalized, tone });
    },
    [pushToast],
  );

  const loadSessions = useCallback(
    async (accessToken: string) => {
      const deviceSessions = await listSessions(accessToken, {
        status: statusFilter,
        sort,
        limit,
        offset,
      });
      setSessions(deviceSessions.data);
      setSessionsMeta(deviceSessions.meta);
    },
    [statusFilter, sort, limit, offset],
  );

  const loadCategories = useCallback(async () => {
    const data = await listCategories({ includeInactive });
    setCategories(data);
  }, [includeInactive]);

  const syncProfileForm = useCallback((profile: WorkerProfile | null) => {
    if (!profile) {
      setProfileBio("");
      setProfileLocation("");
      setProfileHourlyRate("");
      setProfileExperienceYears("0");
      setProfileIsAvailable(true);
      setProfileCategoryIds([]);
      return;
    }

    setProfileBio(profile.bio ?? "");
    setProfileLocation(profile.location ?? "");
    setProfileHourlyRate(
      typeof profile.hourlyRate === "number" ? String(profile.hourlyRate) : "",
    );
    setProfileExperienceYears(String(profile.experienceYears));
    setProfileIsAvailable(profile.isAvailable);
    setProfileCategoryIds(profile.categories.map((item) => item.id));
  }, []);

  const loadMyWorkerProfileData = useCallback(
    async (accessToken: string) => {
      const profile = await getMyWorkerProfile(accessToken);
      setWorkerProfile(profile);
      syncProfileForm(profile);
      return profile;
    },
    [syncProfileForm],
  );

  const loadWorkerProfilesData = useCallback(async () => {
    const result = await listWorkerProfiles({
      categorySlug: workerCategorySlugFilter || undefined,
      isAvailable:
        workerAvailabilityFilter === "all"
          ? undefined
          : workerAvailabilityFilter === "true",
      limit: workerLimit,
      offset: workerOffset,
    });
    setWorkerProfiles(result);
    return result;
  }, [
    workerAvailabilityFilter,
    workerCategorySlugFilter,
    workerLimit,
    workerOffset,
  ]);

  const loadJobWorkerOptions = useCallback(async () => {
    const result = await listWorkerProfiles({
      isAvailable: true,
      limit: 100,
      offset: 0,
    });
    setJobWorkerOptions(result);
    return result;
  }, []);

  const loadJobsData = useCallback(
    async (accessToken: string) => {
      const query = {
        status: jobStatusFilter === "ALL" ? undefined : jobStatusFilter,
        limit: jobLimit,
        offset: jobOffset,
      };

      const [client, worker] = await Promise.all([
        listMyClientJobs(accessToken, query),
        listMyWorkerJobs(accessToken, query),
      ]);

      setClientJobs(client);
      setWorkerJobs(worker);
      return { clientCount: client.length, workerCount: worker.length };
    },
    [jobLimit, jobOffset, jobStatusFilter],
  );

  const loadReviewWorkerOptions = useCallback(async () => {
    const result = await listWorkerProfiles({
      limit: 100,
      offset: 0,
    });
    setReviewWorkerOptions(result);
    return result;
  }, []);

  const loadCompletedClientJobs = useCallback(async (accessToken: string) => {
    const result = await listMyClientJobs(accessToken, {
      status: "COMPLETED",
      limit: 100,
      offset: 0,
    });
    setCompletedClientJobs(result);
    return result;
  }, []);

  const loadReviewsData = useCallback(
    async (accessToken: string) => {
      const [mine, worker] = await Promise.all([
        listMyReviews(accessToken),
        reviewWorkerProfileId
          ? listWorkerReviews(reviewWorkerProfileId)
          : Promise.resolve([] as Review[]),
      ]);

      setMyReviews(mine);
      setWorkerReviews(worker);
      return { myCount: mine.length, workerCount: worker.length };
    },
    [reviewWorkerProfileId],
  );

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const session = await ensureSession();

      if (!isMounted) {
        return;
      }

      if (!session) {
        setStatus("Sessão inválida. Redirecionando...");
        router.replace("/");
        return;
      }

      setState({ auth: session.auth, me: session.me });
      setStatus("Sessão ativa.");
      setLoading(false);
    }

    bootstrap().catch(() => {
      setStatus("Erro ao validar sessão.");
      router.replace("/");
    });

    const stopAutoRefresh = startAutoRefresh((auth) => {
      setState((current) =>
        current
          ? {
              ...current,
              auth,
            }
          : current,
      );
      setStatus("Sessão renovada em background.");
    });

    return () => {
      isMounted = false;
      stopAutoRefresh();
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    setCategoriesLoading(true);
    loadCategories()
      .then(() => {
        setCategoryStatus("Categorias carregadas.");
      })
      .catch((error) => {
        setCategoryStatus(
          humanizeUnknownError(error, "Falha ao carregar categorias."),
        );
      })
      .finally(() => {
        setCategoriesLoading(false);
      });
  }, [isAuthenticated, loadCategories]);

  useEffect(() => {
    if (!state?.auth.accessToken) {
      return;
    }

    loadSessions(state.auth.accessToken).catch((error) => {
      setStatus(humanizeUnknownError(error, "Falha ao carregar sessões."));
    });
  }, [state?.auth.accessToken, loadSessions]);

  useEffect(() => {
    if (!state?.auth.accessToken) {
      return;
    }

    setWorkerProfileLoading(true);
    loadMyWorkerProfileData(state.auth.accessToken)
      .then((profile) => {
        setWorkerProfileStatus(
          profile
            ? "Perfil profissional carregado."
            : "Ainda não tens perfil profissional.",
        );
      })
      .catch((error) => {
        setWorkerProfileStatus(
          humanizeUnknownError(error, "Falha ao carregar o teu perfil profissional."),
        );
      })
      .finally(() => {
        setWorkerProfileLoading(false);
      });
  }, [state?.auth.accessToken, loadMyWorkerProfileData]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    setWorkerProfilesLoading(true);
    loadWorkerProfilesData()
      .then((profiles) => {
        setWorkerProfilesStatus(
          profiles.length > 0
            ? "Profissionais carregados."
            : "Nenhum profissional encontrado para os filtros atuais.",
        );
      })
      .catch((error) => {
        setWorkerProfilesStatus(
          humanizeUnknownError(error, "Falha ao listar perfis profissionais."),
        );
      })
      .finally(() => {
        setWorkerProfilesLoading(false);
      });
  }, [isAuthenticated, loadWorkerProfilesData]);

  useEffect(() => {
    if (!state?.auth.accessToken) {
      return;
    }

    setJobsLoading(true);
    loadJobsData(state.auth.accessToken)
      .then(({ clientCount, workerCount }) => {
        setJobsStatus(
          `Jobs carregados. Cliente: ${clientCount} | Worker: ${workerCount}.`,
        );
      })
      .catch((error) => {
        setJobsStatus(humanizeUnknownError(error, "Falha ao carregar jobs."));
      })
      .finally(() => {
        setJobsLoading(false);
      });
  }, [state?.auth.accessToken, loadJobsData]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadJobWorkerOptions().catch((error) => {
      setJobsStatus(
        humanizeUnknownError(
          error,
          "Falha ao carregar opções de profissionais para criar job.",
        ),
      );
    });
  }, [isAuthenticated, loadJobWorkerOptions]);

  useEffect(() => {
    if (jobWorkerOptions.length === 0) {
      if (jobWorkerProfileId !== "") {
        setJobWorkerProfileId("");
      }
      return;
    }

    const exists = jobWorkerOptions.some(
      (profile) => profile.id === jobWorkerProfileId,
    );
    if (!exists) {
      setJobWorkerProfileId(jobWorkerOptions[0]?.id ?? "");
    }
  }, [jobWorkerOptions, jobWorkerProfileId]);

  useEffect(() => {
    if (availableJobCategories.length === 0) {
      if (jobCategoryId !== "") {
        setJobCategoryId("");
      }
      return;
    }

    const exists = availableJobCategories.some(
      (category) => category.id === jobCategoryId,
    );
    if (!exists) {
      setJobCategoryId(availableJobCategories[0]?.id ?? "");
    }
  }, [availableJobCategories, jobCategoryId]);

  useEffect(() => {
    if (categoryPage > categoryPageCount) {
      setCategoryPage(categoryPageCount);
    }
  }, [categoryPage, categoryPageCount]);

  useEffect(() => {
    setCategoryPage(1);
  }, [categorySearch, categorySortMode, categoryPageSize]);

  useEffect(() => {
    if (!state?.auth.accessToken) {
      return;
    }

    setReviewsLoading(true);
    loadReviewsData(state.auth.accessToken)
      .then(({ myCount, workerCount }) => {
        setReviewsStatus(
          `Reviews carregadas. Minhas: ${myCount} | Worker selecionado: ${workerCount}.`,
        );
      })
      .catch((error) => {
        setReviewsStatus(humanizeUnknownError(error, "Falha ao carregar reviews."));
      })
      .finally(() => {
        setReviewsLoading(false);
      });
  }, [state?.auth.accessToken, loadReviewsData]);

  useEffect(() => {
    if (!state?.auth.accessToken) {
      return;
    }

    loadCompletedClientJobs(state.auth.accessToken).catch((error) => {
      setReviewsStatus(
        humanizeUnknownError(error, "Falha ao carregar jobs completos para review."),
      );
    });
  }, [state?.auth.accessToken, loadCompletedClientJobs]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadReviewWorkerOptions().catch((error) => {
      setReviewsStatus(
        humanizeUnknownError(error, "Falha ao carregar opções de worker para reviews."),
      );
    });
  }, [isAuthenticated, loadReviewWorkerOptions]);

  useEffect(() => {
    if (reviewWorkerOptions.length === 0) {
      if (reviewWorkerProfileId !== "") {
        setReviewWorkerProfileId("");
      }
      return;
    }

    const exists = reviewWorkerOptions.some(
      (profile) => profile.id === reviewWorkerProfileId,
    );
    if (!exists) {
      setReviewWorkerProfileId(reviewWorkerOptions[0]?.id ?? "");
    }
  }, [reviewWorkerOptions, reviewWorkerProfileId]);

  useEffect(() => {
    if (reviewableJobs.length === 0) {
      if (reviewJobId !== "") {
        setReviewJobId("");
      }
      return;
    }

    const exists = reviewableJobs.some((job) => job.id === reviewJobId);
    if (!exists) {
      setReviewJobId(reviewableJobs[0]?.id ?? "");
    }
  }, [reviewJobId, reviewableJobs]);

  useEffect(() => {
    pushStatusToast("global", status);
  }, [status, pushStatusToast]);

  useEffect(() => {
    pushStatusToast("categories", categoryStatus);
  }, [categoryStatus, pushStatusToast]);

  useEffect(() => {
    pushStatusToast("profile", workerProfileStatus);
  }, [workerProfileStatus, pushStatusToast]);

  useEffect(() => {
    pushStatusToast("workers", workerProfilesStatus);
  }, [workerProfilesStatus, pushStatusToast]);

  useEffect(() => {
    pushStatusToast("jobs", jobsStatus);
  }, [jobsStatus, pushStatusToast]);

  useEffect(() => {
    pushStatusToast("reviews", reviewsStatus);
  }, [reviewsStatus, pushStatusToast]);

  async function handleRefreshNow() {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) {
      setStatus("Refresh token ausente.");
      return;
    }

    setStatus("A renovar sessão...");

    try {
      const auth = await refresh(refreshToken);
      saveTokens(auth);
      setState((current) => (current ? { ...current, auth } : current));
      await loadSessions(auth.accessToken);
      setStatus("Sessão renovada com sucesso.");
    } catch (error) {
      clearTokens();
      setStatus(humanizeUnknownError(error, "Falha no refresh."));
      router.replace("/");
    }
  }

  async function handleLogout() {
    const { refreshToken } = getStoredTokens();

    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } finally {
      clearTokens();
      setStatus("Logout concluído.");
      router.replace("/");
    }
  }

  async function handleLogoutAll() {
    const { accessToken } = getStoredTokens();

    if (!accessToken) {
      setStatus("Access token ausente.");
      return;
    }

    try {
      await logoutAll(accessToken);
    } finally {
      clearTokens();
      setStatus("Todas as sessões foram terminadas.");
      router.replace("/");
    }
  }

  async function handleRevokeSession(sessionId: string) {
    const { accessToken } = getStoredTokens();

    if (!accessToken) {
      setStatus("Access token ausente.");
      return;
    }

    try {
      await revokeSession(accessToken, sessionId);
      await loadSessions(accessToken);
      setStatus("Sessão revogada.");
    } catch (error) {
      setStatus(humanizeUnknownError(error, "Falha ao revogar sessão."));
    }
  }

  function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function formatJobStatus(status: JobStatus): string {
    return status
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/(^\w|\s\w)/g, (part) => part.toUpperCase());
  }

  async function handleReloadSessions() {
    const { accessToken } = getStoredTokens();

    if (!accessToken) {
      setStatus("Access token ausente.");
      return;
    }

    try {
      await loadSessions(accessToken);
      setStatus("Sessões recarregadas.");
    } catch (error) {
      setStatus(humanizeUnknownError(error, "Falha ao carregar sessões."));
    }
  }

  async function handleReloadCategories() {
    setCategoriesLoading(true);
    setCategoryStatus("A recarregar categorias...");

    try {
      await loadCategories();
      setCategoryStatus("Categorias recarregadas.");
    } catch (error) {
      setCategoryStatus(
        humanizeUnknownError(error, "Falha ao carregar categorias."),
      );
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setCategoryStatus("Access token ausente.");
      return;
    }

    const normalizedName = categoryName.trim();
    const normalizedSlug = categorySlug.trim().toLowerCase();
    const normalizedDescription = categoryDescription.trim();

    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setCategoryStatus("Nome da categoria deve ter entre 2 e 80 caracteres.");
      return;
    }

    if (
      normalizedSlug.length > 0 &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)
    ) {
      setCategoryStatus(
        "Slug inválido. Usa letras minúsculas, números e hífens.",
      );
      return;
    }

    if (normalizedDescription.length > 280) {
      setCategoryStatus("Descrição da categoria deve ter no máximo 280 caracteres.");
      return;
    }

    const parsedSortOrder = Number(categorySortOrder);
    if (
      !Number.isInteger(parsedSortOrder) ||
      parsedSortOrder < 0 ||
      parsedSortOrder > 10_000
    ) {
      setCategoryStatus("sortOrder deve ser um inteiro entre 0 e 10000.");
      return;
    }

    setCategoriesLoading(true);
    setCategoryStatus("A criar categoria...");

    try {
      await createCategory(accessToken, {
        name: normalizedName,
        slug: normalizedSlug || undefined,
        description: normalizedDescription || undefined,
        sortOrder: parsedSortOrder,
      });

      setCategoryName("");
      setCategorySlug("");
      setCategoryDescription("");
      setCategorySortOrder("0");
      await loadCategories();
      setCategoryStatus("Categoria criada com sucesso.");
    } catch (error) {
      setCategoryStatus(humanizeUnknownError(error, "Falha ao criar categoria."));
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function handleDeactivateCategory(categoryId: string) {
    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setCategoryStatus("Access token ausente.");
      return;
    }

    setCategoriesLoading(true);
    setCategoryStatus("A desativar categoria...");

    try {
      await deactivateCategory(accessToken, categoryId);
      await loadCategories();
      setCategoryStatus("Categoria desativada.");
    } catch (error) {
      setCategoryStatus(
        humanizeUnknownError(error, "Falha ao desativar categoria."),
      );
    } finally {
      setCategoriesLoading(false);
    }
  }

  function toggleProfileCategory(categoryId: string, checked: boolean) {
    setProfileCategoryIds((current) => {
      if (checked) {
        return current.includes(categoryId) ? current : [...current, categoryId];
      }

      return current.filter((id) => id !== categoryId);
    });
  }

  async function handleReloadMyWorkerProfile() {
    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setWorkerProfileStatus("Access token ausente.");
      return;
    }

    setWorkerProfileLoading(true);
    setWorkerProfileStatus("A carregar o teu perfil profissional...");

    try {
      const profile = await loadMyWorkerProfileData(accessToken);
      setWorkerProfileStatus(
        profile ? "Perfil profissional recarregado." : "Ainda não tens perfil profissional.",
      );
    } catch (error) {
      setWorkerProfileStatus(
        humanizeUnknownError(error, "Falha ao carregar o teu perfil profissional."),
      );
    } finally {
      setWorkerProfileLoading(false);
    }
  }

  async function handleSaveWorkerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setWorkerProfileStatus("Access token ausente.");
      return;
    }

    const trimmedHourlyRate = profileHourlyRate.trim();
    const trimmedExperienceYears = profileExperienceYears.trim();

    let hourlyRate: number | undefined;
    if (trimmedHourlyRate.length > 0) {
      const parsedHourlyRate = Number(trimmedHourlyRate);
      if (
        !Number.isInteger(parsedHourlyRate) ||
        parsedHourlyRate < 0 ||
        parsedHourlyRate > 1_000_000
      ) {
        setWorkerProfileStatus("hourlyRate deve ser inteiro entre 0 e 1000000.");
        return;
      }
      hourlyRate = parsedHourlyRate;
    }

    let experienceYears: number | undefined;
    if (trimmedExperienceYears.length > 0) {
      const parsedExperienceYears = Number(trimmedExperienceYears);
      if (
        !Number.isInteger(parsedExperienceYears) ||
        parsedExperienceYears < 0 ||
        parsedExperienceYears > 80
      ) {
        setWorkerProfileStatus("experienceYears deve ser inteiro entre 0 e 80.");
        return;
      }
      experienceYears = parsedExperienceYears;
    }

    const normalizedBio = profileBio.trim();
    const normalizedLocation = profileLocation.trim();
    if (normalizedBio.length > 1000) {
      setWorkerProfileStatus("Bio deve ter no máximo 1000 caracteres.");
      return;
    }

    if (normalizedLocation.length > 120) {
      setWorkerProfileStatus("Localização deve ter no máximo 120 caracteres.");
      return;
    }

    const activeCategoryIdSet = new Set(activeCategories.map((item) => item.id));
    const validCategoryIds = profileCategoryIds.filter((id) =>
      activeCategoryIdSet.has(id),
    );
    if (validCategoryIds.length === 0) {
      setWorkerProfileStatus("Seleciona pelo menos uma categoria ativa.");
      return;
    }

    setWorkerProfileLoading(true);
    setWorkerProfileStatus("A guardar perfil profissional...");

    try {
      const savedProfile = await upsertMyWorkerProfile(accessToken, {
        bio: normalizedBio || undefined,
        location: normalizedLocation || undefined,
        hourlyRate,
        experienceYears,
        isAvailable: profileIsAvailable,
        categoryIds: validCategoryIds,
      });
      setWorkerProfile(savedProfile);
      syncProfileForm(savedProfile);
      setWorkerProfileStatus("Perfil profissional guardado com sucesso.");
      await loadWorkerProfilesData();
      await loadJobWorkerOptions();
      await loadReviewWorkerOptions();
    } catch (error) {
      setWorkerProfileStatus(
        humanizeUnknownError(error, "Falha ao guardar perfil profissional."),
      );
    } finally {
      setWorkerProfileLoading(false);
    }
  }

  async function handleReloadWorkerProfiles() {
    setWorkerProfilesLoading(true);
    setWorkerProfilesStatus("A recarregar profissionais...");

    try {
      const profiles = await loadWorkerProfilesData();
      setWorkerProfilesStatus(
        profiles.length > 0
          ? "Profissionais recarregados."
          : "Nenhum profissional encontrado para os filtros atuais.",
      );
    } catch (error) {
      setWorkerProfilesStatus(
        humanizeUnknownError(error, "Falha ao listar perfis profissionais."),
      );
    } finally {
      setWorkerProfilesLoading(false);
    }
  }

  async function handleReloadJobs() {
    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setJobsStatus("Access token ausente.");
      return;
    }

    setJobsLoading(true);
    setJobsStatus("A recarregar jobs...");

    try {
      const { clientCount, workerCount } = await loadJobsData(accessToken);
      setJobsStatus(
        `Jobs recarregados. Cliente: ${clientCount} | Worker: ${workerCount}.`,
      );
    } catch (error) {
      setJobsStatus(humanizeUnknownError(error, "Falha ao recarregar jobs."));
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setJobsStatus("Access token ausente.");
      return;
    }

    if (!jobWorkerProfileId) {
      setJobsStatus("Seleciona um profissional para criar o job.");
      return;
    }

    if (!jobCategoryId) {
      setJobsStatus("Seleciona uma categoria para criar o job.");
      return;
    }

    const normalizedTitle = jobTitle.trim();
    const normalizedDescription = jobDescription.trim();
    if (normalizedTitle.length < 3 || normalizedTitle.length > 120) {
      setJobsStatus("Título do job deve ter entre 3 e 120 caracteres.");
      return;
    }

    if (normalizedDescription.length < 10 || normalizedDescription.length > 2000) {
      setJobsStatus("Descrição do job deve ter entre 10 e 2000 caracteres.");
      return;
    }

    const selectedCategoryStillAllowed = availableJobCategories.some(
      (category) => category.id === jobCategoryId,
    );
    if (!selectedCategoryStillAllowed) {
      setJobsStatus(
        "Categoria inválida para o profissional selecionado. Escolhe outra categoria.",
      );
      return;
    }

    const parsedBudget = Number(jobBudget.trim());
    if (!Number.isInteger(parsedBudget) || parsedBudget < 0 || parsedBudget > 100_000_000) {
      setJobsStatus("budget deve ser inteiro entre 0 e 100000000.");
      return;
    }

    let scheduledForIso: string | undefined;
    if (jobScheduledFor.trim().length > 0) {
      const parsedDate = new Date(jobScheduledFor);
      if (Number.isNaN(parsedDate.getTime())) {
        setJobsStatus("Data agendada inválida.");
        return;
      }
      scheduledForIso = parsedDate.toISOString();
    }

    setJobsLoading(true);
    setJobsStatus("A criar job...");

    try {
      await createJob(accessToken, {
        workerProfileId: jobWorkerProfileId,
        categoryId: jobCategoryId,
        title: normalizedTitle,
        description: normalizedDescription,
        budget: parsedBudget,
        scheduledFor: scheduledForIso,
      });

      setJobTitle("");
      setJobDescription("");
      setJobBudget("");
      setJobScheduledFor("");

      const { clientCount, workerCount } = await loadJobsData(accessToken);
      await loadCompletedClientJobs(accessToken);
      setJobsStatus(
        `Job criado com sucesso. Cliente: ${clientCount} | Worker: ${workerCount}.`,
      );
    } catch (error) {
      setJobsStatus(humanizeUnknownError(error, "Falha ao criar job."));
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleUpdateJobStatus(
    jobId: string,
    nextStatus: JobStatus,
    roleLabel: "client" | "worker",
  ) {
    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setJobsStatus("Access token ausente.");
      return;
    }

    setJobsLoading(true);
    setJobsStatus(`A atualizar job (${roleLabel}) para ${formatJobStatus(nextStatus)}...`);

    try {
      await updateJobStatus(accessToken, jobId, nextStatus);
      const { clientCount, workerCount } = await loadJobsData(accessToken);
      await loadCompletedClientJobs(accessToken);
      setJobsStatus(
        `Status atualizado para ${formatJobStatus(nextStatus)}. Cliente: ${clientCount} | Worker: ${workerCount}.`,
      );
    } catch (error) {
      setJobsStatus(
        humanizeUnknownError(error, "Falha ao atualizar status do job."),
      );
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleReloadReviews() {
    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setReviewsStatus("Access token ausente.");
      return;
    }

    setReviewsLoading(true);
    setReviewsStatus("A recarregar reviews...");

    try {
      const [{ myCount, workerCount }, reviewJobs] = await Promise.all([
        loadReviewsData(accessToken),
        loadCompletedClientJobs(accessToken),
      ]);
      setReviewsStatus(
        `Reviews recarregadas. Minhas: ${myCount} | Worker selecionado: ${workerCount} | Jobs completos: ${reviewJobs.length}.`,
      );
    } catch (error) {
      setReviewsStatus(
        humanizeUnknownError(error, "Falha ao recarregar reviews."),
      );
    } finally {
      setReviewsLoading(false);
    }
  }

  async function handleCreateReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accessToken = state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setReviewsStatus("Access token ausente.");
      return;
    }

    if (!reviewJobId) {
      setReviewsStatus("Seleciona um job completo para avaliar.");
      return;
    }

    const canReviewSelectedJob = reviewableJobs.some((job) => job.id === reviewJobId);
    if (!canReviewSelectedJob) {
      setReviewsStatus("Este job já foi avaliado ou não está elegível para review.");
      return;
    }

    const parsedRating = Number(reviewRating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      setReviewsStatus("rating deve ser inteiro entre 1 e 5.");
      return;
    }

    const normalizedComment = reviewComment.trim();
    if (normalizedComment.length > 1000) {
      setReviewsStatus("Comentário deve ter no máximo 1000 caracteres.");
      return;
    }

    setReviewsLoading(true);
    setReviewsStatus("A criar review...");

    try {
      await createReview(accessToken, {
        jobId: reviewJobId,
        rating: parsedRating,
        comment: normalizedComment || undefined,
      });

      setReviewComment("");
      setReviewRating("5");

      const [{ myCount, workerCount }, reviewJobs] = await Promise.all([
        loadReviewsData(accessToken),
        loadCompletedClientJobs(accessToken),
        loadWorkerProfilesData(),
        loadReviewWorkerOptions(),
      ]);

      setReviewsStatus(
        `Review criada com sucesso. Minhas: ${myCount} | Worker selecionado: ${workerCount} | Jobs restantes para review: ${reviewJobs.length}.`,
      );
    } catch (error) {
      setReviewsStatus(humanizeUnknownError(error, "Falha ao criar review."));
    } finally {
      setReviewsLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="card">
          <h1>A validar sessão...</h1>
          <p className="status">{status}</p>
        </section>
      </main>
    );
  }

  if (!state) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <main className="shell">
        <section className="card">
          <h1>Sessão inválida</h1>
          <p className="status status--error">
            Não foi possível validar permissões para abrir o dashboard.
          </p>
          <p className="status">
            <Link href="/" className="nav-link">
              Voltar ao login
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="card card--wide">
        <header className="header">
          <p className="kicker">Tchuno Dashboard</p>
          <h1>Centro de Operações</h1>
          <p className="subtitle">
            Fluxo completo para gerir sessões, perfis, jobs e reviews com passos
            claros.
          </p>
        </header>

        <nav className="dashboard-nav">
          <a href="#overview">Visão geral</a>
          <a href="#sessions">Sessões</a>
          <a href="#categories">Categorias</a>
          <a href="#my-profile">Meu perfil</a>
          <a href="#workers">Profissionais</a>
          <a href="#jobs">Jobs</a>
          <a href="#reviews">Reviews</a>
        </nav>

        <section id="overview" className="dashboard-section">
          <h2 className="section-title">Visão Geral Rápida</h2>
          <p className="section-lead">
            Se a conta estiver vazia, segue esta ordem: categorias, perfil de
            worker, primeiro job e review após conclusão.
          </p>
          <div className="overview-grid">
            <article className="metric-card">
              <p className="metric-label">Sessões ativas visíveis</p>
              <p className="metric-value">{activeSessionCount}</p>
              <p className="metric-note">
                Revoga sessões antigas para reduzir risco de acesso indevido.
              </p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Categorias ativas</p>
              <p className="metric-value">{activeCategories.length}</p>
              <p className="metric-note">
                São a base de matching entre cliente e profissional.
              </p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Jobs concluídos (cliente)</p>
              <p className="metric-value">{myCompletedJobsCount}</p>
              <p className="metric-note">
                Cada job completo desbloqueia uma review legítima.
              </p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Reviews pendentes</p>
              <p className="metric-value">{reviewableJobs.length}</p>
              <p className="metric-note">
                Fecha o ciclo com feedback para melhorar confiança da plataforma.
              </p>
            </article>
          </div>
        </section>

        <div className="actions cta-actions">
          <button type="button" onClick={handleRefreshNow}>
            Renovar sessão
          </button>
          <button type="button" onClick={handleLogout}>
            Terminar sessão
          </button>
          <button type="button" onClick={handleLogoutAll}>
            Terminar todas
          </button>
        </div>

        <p className={`status status--${getStatusTone(status)}`}>Status: {status}</p>

        <details className="debug-panel">
          <summary>Debug de sessão</summary>
          <pre className="result">
            {JSON.stringify(
              {
                me: state.me,
                user: state.auth.user,
                accessToken: `${state.auth.accessToken.slice(0, 24)}...`,
                refreshToken: `${state.auth.refreshToken.slice(0, 24)}...`,
              },
              null,
              2,
            )}
          </pre>
        </details>

        <section id="sessions" className="dashboard-section">
          <h2 className="section-title">Dispositivos e Sessões</h2>
          <p className="section-lead">
            Segurança em mobile-first: acompanha atividade por dispositivo e
            revoga o que não reconheces.
          </p>

          <div className="section-toolbar">
            <label>
              Estado
              <select
                value={statusFilter}
                onChange={(event) => {
                  setOffset(0);
                  setStatusFilter(event.target.value as SessionListQuery["status"]);
                }}
              >
                <option value="active">Ativas</option>
                <option value="revoked">Revogadas</option>
                <option value="all">Todas</option>
              </select>
            </label>
            <label>
              Ordenar
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SessionListQuery["sort"])
                }
              >
                <option value="lastUsedAt:desc">Último uso (desc)</option>
                <option value="lastUsedAt:asc">Último uso (asc)</option>
                <option value="createdAt:desc">Criação (desc)</option>
                <option value="createdAt:asc">Criação (asc)</option>
              </select>
            </label>
            <label>
              Itens/página
              <select
                value={String(limit)}
                onChange={(event) => {
                  setOffset(0);
                  setLimit(Number(event.target.value));
                }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </label>
            <button type="button" onClick={handleReloadSessions}>
              Recarregar
            </button>
          </div>

          <div className="meta-row">
            <button
              type="button"
              onClick={() => setOffset((current) => Math.max(0, current - limit))}
              disabled={!sessionsMeta?.hasPrev}
            >
              Página anterior
            </button>
            <button
              type="button"
              onClick={() => setOffset((current) => current + limit)}
              disabled={!sessionsMeta?.hasNext}
            >
              Próxima página
            </button>
            <p className="status">
              Página: {sessionsMeta?.page ?? 1}/{sessionsMeta?.pageCount ?? 1}
            </p>
            <p className="status">Total: {sessionsMeta?.total ?? sessions.length}</p>
          </div>

          <div className="result">
            {sessions.length === 0 ? (
              <p className="empty-state">
                Ainda não há sessões neste filtro. Usa <strong>Todas</strong> para
                validar histórico e garantir que só tens dispositivos confiáveis.
              </p>
            ) : (
              sessions.map((session) => {
                const isCurrentDevice = session.deviceId === currentDeviceId;
                const isRevoked = Boolean(session.revokedAt);
                return (
                  <article key={session.id} className="list-item session-item">
                    <p className="item-title">
                      {isCurrentDevice ? "Dispositivo atual" : "Dispositivo"}
                      <span className={`status-pill ${isRevoked ? "is-danger" : "is-ok"}`}>
                        {isRevoked ? "Revogada" : "Ativa"}
                      </span>
                    </p>
                    <p>
                      <strong>ID:</strong> {shortenId(session.deviceId)}
                    </p>
                    <p>
                      <strong>IP:</strong> {session.ip ?? "n/a"}
                    </p>
                    <p>
                      <strong>Criada:</strong> {formatDate(session.createdAt)}
                    </p>
                    <p>
                      <strong>Último uso:</strong> {formatDate(session.lastUsedAt)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={isRevoked || isCurrentDevice}
                    >
                      {isCurrentDevice ? "Sessão atual" : "Revogar sessão"}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section id="categories" className="dashboard-section">
          <h2 className="section-title">Categorias</h2>
          <p className="section-lead">
            Categorias consistentes reduzem erros de criação de job e deixam o
            fluxo do cliente mais rápido.
          </p>
          <p className={`status status--${getStatusTone(categoryStatus)}`}>
            {categoryStatus}
          </p>

          <div className="section-toolbar">
            <label className="inline-check">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Incluir inativas
            </label>
            <label>
              Pesquisar
              <input
                type="search"
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
                placeholder="Nome, slug ou descrição"
              />
            </label>
            <label>
              Ordenar
              <select
                value={categorySortMode}
                onChange={(event) =>
                  setCategorySortMode(
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
                onChange={(event) => setCategoryPageSize(Number(event.target.value))}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleReloadCategories}
              disabled={categoriesLoading}
            >
              Recarregar
            </button>
          </div>

          <div className="meta-row">
            <button
              type="button"
              onClick={() => setCategoryPage((current) => Math.max(1, current - 1))}
              disabled={categoryPage <= 1 || categoriesLoading}
            >
              Página anterior
            </button>
            <button
              type="button"
              onClick={() =>
                setCategoryPage((current) => Math.min(categoryPageCount, current + 1))
              }
              disabled={categoryPage >= categoryPageCount || categoriesLoading}
            >
              Próxima página
            </button>
            <p className="status">
              Página: {categoryPage}/{categoryPageCount}
            </p>
            <p className="status">
              Visíveis: {visibleCategories.length}/{filteredSortedCategories.length}
            </p>
          </div>

          <form onSubmit={handleCreateCategory} className="form">
            <label>
              Nome
              <input
                type="text"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
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
                onChange={(event) => setCategorySlug(event.target.value)}
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
                onChange={(event) => setCategoryDescription(event.target.value)}
                maxLength={280}
              />
            </label>
            <label>
              Ordem
              <input
                type="number"
                value={categorySortOrder}
                onChange={(event) => setCategorySortOrder(event.target.value)}
                min={0}
                max={10000}
                step={1}
                required
              />
            </label>
            <button type="submit" className="primary" disabled={categoriesLoading}>
              {categoriesLoading ? "Aguarda..." : "Criar categoria"}
            </button>
          </form>

          <div className="result">
            {categoriesLoading && categories.length === 0 ? (
              <p>A carregar categorias...</p>
            ) : filteredSortedCategories.length === 0 ? (
              <p className="empty-state">
                {categorySearch.trim().length > 0
                  ? "Nenhuma categoria corresponde ao filtro atual."
                  : "Ainda não tens categorias. Cria a primeira categoria para desbloquear perfis e jobs."}
              </p>
            ) : (
              visibleCategories.map((category) => (
                <article key={category.id} className="list-item">
                  <p className="item-title">
                    {category.name}
                    <span className={`status-pill ${category.isActive ? "is-ok" : "is-muted"}`}>
                      {category.isActive ? "Ativa" : "Inativa"}
                    </span>
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
                    onClick={() => handleDeactivateCategory(category.id)}
                    disabled={categoriesLoading || !category.isActive}
                  >
                    {category.isActive ? "Desativar categoria" : "Inativa"}
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section id="my-profile" className="dashboard-section">
          <h2 className="section-title">Meu Perfil de Worker</h2>
          <p className="section-lead">
            Um perfil completo aumenta confiança: localização, experiência,
            tarifa e categorias claras.
          </p>
          <p className={`status status--${getStatusTone(workerProfileStatus)}`}>
            {workerProfileStatus}
          </p>

          <div className="section-toolbar">
            <button
              type="button"
              onClick={handleReloadMyWorkerProfile}
              disabled={workerProfileLoading}
            >
              Recarregar perfil
            </button>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={profileIsAvailable}
                onChange={(event) => setProfileIsAvailable(event.target.checked)}
              />
              Disponível para trabalhos
            </label>
          </div>

          <form onSubmit={handleSaveWorkerProfile} className="form">
            <label>
              Bio (opcional)
              <textarea
                value={profileBio}
                onChange={(event) => setProfileBio(event.target.value)}
                maxLength={1000}
              />
            </label>
            <label>
              Localização (opcional)
              <input
                type="text"
                value={profileLocation}
                onChange={(event) => setProfileLocation(event.target.value)}
                maxLength={120}
              />
            </label>
            <label>
              Tarifa por hora (opcional)
              <input
                type="number"
                value={profileHourlyRate}
                onChange={(event) => setProfileHourlyRate(event.target.value)}
                min={0}
                max={1_000_000}
                step={1}
              />
            </label>
            <label>
              Anos de experiência
              <input
                type="number"
                value={profileExperienceYears}
                onChange={(event) => setProfileExperienceYears(event.target.value)}
                min={0}
                max={80}
                step={1}
                required
              />
            </label>

            <div className="result">
              <p className="item-title">Categorias ativas</p>
              {activeCategories.length === 0 ? (
                <p className="empty-state">
                  Sem categorias ativas. Vai à secção de categorias e cria pelo
                  menos uma antes de guardar o perfil.
                </p>
              ) : (
                <div className="checkbox-list">
                  {activeCategories.map((category) => (
                    <label key={category.id}>
                      <input
                        type="checkbox"
                        checked={profileCategoryIds.includes(category.id)}
                        onChange={(event) =>
                          toggleProfileCategory(category.id, event.target.checked)
                        }
                      />
                      {category.name} ({category.slug})
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="primary" disabled={workerProfileLoading}>
              {workerProfileLoading ? "Aguarda..." : "Guardar perfil profissional"}
            </button>
          </form>

          <div className="result">
            {workerProfile ? (
              <article className="worker-card">
                <p className="item-title">
                  Perfil público pronto
                  <span
                    className={`status-pill ${
                      workerProfile.isAvailable ? "is-ok" : "is-muted"
                    }`}
                  >
                    {workerProfile.isAvailable ? "Disponível" : "Indisponível"}
                  </span>
                </p>
                <p>
                  <strong>Worker:</strong> {workerProfile.userId}
                </p>
                <p>
                  <strong>Tarifa:</strong>{" "}
                  {typeof workerProfile.hourlyRate === "number"
                    ? formatCurrencyMzn(workerProfile.hourlyRate)
                    : "Não definida"}
                </p>
                <p>
                  <strong>Experiência:</strong> {workerProfile.experienceYears} anos
                </p>
                <p>
                  <strong>Rating:</strong>{" "}
                  {formatStars(workerProfile.ratingAvg)}{" "}
                  {formatRatingValue(workerProfile.ratingAvg)} ({workerProfile.ratingCount})
                </p>
                <p>
                  <strong>Categorias:</strong>{" "}
                  {workerProfile.categories.length > 0
                    ? workerProfile.categories.map((item) => item.name).join(", ")
                    : "Sem categorias"}
                </p>
                {workerProfile.bio ? <p>{workerProfile.bio}</p> : null}
              </article>
            ) : (
              <p className="empty-state">
                Ainda não tens perfil profissional. Preenche o formulário acima e
                publica o teu perfil para aparecer na busca de clientes.
              </p>
            )}
          </div>
        </section>

        <section id="workers" className="dashboard-section">
          <h2 className="section-title">Descoberta de Profissionais</h2>
          <p className="section-lead">
            Esta vista simula o perfil público que um cliente usa para decidir
            em quem confiar.
          </p>
          <p className={`status status--${getStatusTone(workerProfilesStatus)}`}>
            {workerProfilesStatus}
          </p>

          <div className="section-toolbar">
            <label>
              Categoria
              <select
                value={workerCategorySlugFilter}
                onChange={(event) => {
                  setWorkerOffset(0);
                  setWorkerCategorySlugFilter(event.target.value);
                }}
              >
                <option value="">Todas as categorias</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Disponibilidade
              <select
                value={workerAvailabilityFilter}
                onChange={(event) => {
                  setWorkerOffset(0);
                  setWorkerAvailabilityFilter(
                    event.target.value as "all" | "true" | "false",
                  );
                }}
              >
                <option value="all">Todos</option>
                <option value="true">Disponíveis</option>
                <option value="false">Indisponíveis</option>
              </select>
            </label>
            <label>
              Limite API
              <select
                value={String(workerLimit)}
                onChange={(event) => {
                  setWorkerOffset(0);
                  setWorkerLimit(Number(event.target.value));
                }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </label>
            <label>
              Pesquisar
              <input
                type="search"
                value={workerSearch}
                onChange={(event) => setWorkerSearch(event.target.value)}
                placeholder="userId, localização ou categoria"
              />
            </label>
            <label>
              Ordenar
              <select
                value={workerSortMode}
                onChange={(event) =>
                  setWorkerSortMode(
                    event.target.value as
                      | "updatedAt:desc"
                      | "rating:desc"
                      | "hourlyRate:asc"
                      | "hourlyRate:desc",
                  )
                }
              >
                <option value="updatedAt:desc">Atualização (desc)</option>
                <option value="rating:desc">Rating (desc)</option>
                <option value="hourlyRate:asc">Tarifa (asc)</option>
                <option value="hourlyRate:desc">Tarifa (desc)</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleReloadWorkerProfiles}
              disabled={workerProfilesLoading}
            >
              Recarregar
            </button>
          </div>

          <div className="meta-row">
            <button
              type="button"
              onClick={() =>
                setWorkerOffset((current) => Math.max(0, current - workerLimit))
              }
              disabled={workerProfilesLoading || workerOffset === 0}
            >
              Página anterior
            </button>
            <button
              type="button"
              onClick={() => setWorkerOffset((current) => current + workerLimit)}
              disabled={workerProfilesLoading || workerProfiles.length < workerLimit}
            >
              Próxima página
            </button>
            <p className="status">Página: {Math.floor(workerOffset / workerLimit) + 1}</p>
            <p className="status">
              Visíveis: {visibleWorkerProfiles.length}/{workerProfiles.length}
            </p>
          </div>

          <div className="result">
            {workerProfilesLoading && workerProfiles.length === 0 ? (
              <p>A carregar profissionais...</p>
            ) : visibleWorkerProfiles.length === 0 ? (
              <p className="empty-state">
                {workerSearch.trim().length > 0
                  ? "Nenhum profissional corresponde à pesquisa atual."
                  : "Não há profissionais para estes filtros. Tenta remover o filtro de categoria ou disponibilidade."}
              </p>
            ) : (
              <div className="panel-grid">
                {visibleWorkerProfiles.map((profile) => {
                  const isMe = profile.userId === state.auth.user.id;
                  return (
                    <article key={profile.id} className="worker-card">
                      <p className="item-title">
                        {isMe ? "O teu perfil" : `Worker ${shortenId(profile.userId)}`}
                        <span
                          className={`status-pill ${
                            profile.isAvailable ? "is-ok" : "is-muted"
                          }`}
                        >
                          {profile.isAvailable ? "Disponível" : "Indisponível"}
                        </span>
                      </p>
                      <p>
                        <strong>Rating:</strong> {formatStars(profile.ratingAvg)}{" "}
                        {formatRatingValue(profile.ratingAvg)} ({profile.ratingCount})
                      </p>
                      <p>
                        <strong>Tarifa:</strong>{" "}
                        {typeof profile.hourlyRate === "number"
                          ? formatCurrencyMzn(profile.hourlyRate)
                          : "Não definida"}
                      </p>
                      <p>
                        <strong>Experiência:</strong> {profile.experienceYears} anos
                      </p>
                      <p>
                        <strong>Localização:</strong> {profile.location ?? "n/a"}
                      </p>
                      <p>
                        <strong>Categorias:</strong>{" "}
                        {profile.categories.length > 0
                          ? profile.categories.map((item) => item.name).join(", ")
                          : "Sem categorias"}
                      </p>
                      <p className="muted">Atualizado: {formatDate(profile.updatedAt)}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section id="jobs" className="dashboard-section">
          <h2 className="section-title">Jobs</h2>
          <p className="section-lead">
            Criação guiada: confirma pré-requisitos, publica o pedido e acompanha
            as transições de estado.
          </p>
          <p className={`status status--${getStatusTone(jobsStatus)}`}>{jobsStatus}</p>

          <div className="result">
            <p className="item-title">Checklist antes de criar job</p>
            <ul className="checklist">
              {jobCreationChecklist.map((item) => (
                <li key={item.label} className={item.ready ? "is-ready" : "is-blocked"}>
                  <strong>{item.ready ? "Pronto" : "Pendente"}:</strong> {item.label}.{" "}
                  {item.help}
                </li>
              ))}
            </ul>
            <p className="muted">
              Worker selecionado:{" "}
              {selectedJobWorkerProfile
                ? `${shortenId(selectedJobWorkerProfile.userId)} (${
                    selectedJobWorkerProfile.location ?? "n/a"
                  })`
                : "Nenhum"}
            </p>
            <p className="muted">
              Categorias compatíveis com o worker: {availableJobCategories.length}
            </p>
          </div>

          <div className="section-toolbar">
            <label>
              Estado
              <select
                value={jobStatusFilter}
                onChange={(event) => {
                  setJobOffset(0);
                  setJobStatusFilter(event.target.value as "ALL" | JobStatus);
                }}
              >
                <option value="ALL">Todos os estados</option>
                {jobStatuses.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {formatJobStatus(statusOption)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Limite API
              <select
                value={String(jobLimit)}
                onChange={(event) => {
                  setJobOffset(0);
                  setJobLimit(Number(event.target.value));
                }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </label>
            <label>
              Pesquisar
              <input
                type="search"
                value={jobSearch}
                onChange={(event) => setJobSearch(event.target.value)}
                placeholder="Título ou descrição"
              />
            </label>
            <label>
              Ordenar
              <select
                value={jobSortMode}
                onChange={(event) =>
                  setJobSortMode(
                    event.target.value as
                      | "createdAt:desc"
                      | "budget:asc"
                      | "budget:desc",
                  )
                }
              >
                <option value="createdAt:desc">Criação (desc)</option>
                <option value="budget:asc">Orçamento (asc)</option>
                <option value="budget:desc">Orçamento (desc)</option>
              </select>
            </label>
            <button type="button" onClick={handleReloadJobs} disabled={jobsLoading}>
              Recarregar
            </button>
          </div>

          <div className="meta-row">
            <button
              type="button"
              onClick={() => setJobOffset((current) => Math.max(0, current - jobLimit))}
              disabled={jobsLoading || jobOffset === 0}
            >
              Página anterior
            </button>
            <button
              type="button"
              onClick={() => setJobOffset((current) => current + jobLimit)}
              disabled={
                jobsLoading ||
                (clientJobs.length < jobLimit && workerJobs.length < jobLimit)
              }
            >
              Próxima página
            </button>
            <p className="status">Página: {Math.floor(jobOffset / jobLimit) + 1}</p>
            <p className="status">
              Cliente {visibleClientJobs.length}/{clientJobs.length} | Worker{" "}
              {visibleWorkerJobs.length}/{workerJobs.length}
            </p>
          </div>

          <form onSubmit={handleCreateJob} className="form">
            <label>
              Profissional
              <select
                value={jobWorkerProfileId}
                onChange={(event) => setJobWorkerProfileId(event.target.value)}
                required
              >
                {jobWorkerOptions.length === 0 ? (
                  <option value="">Sem profissionais disponíveis</option>
                ) : (
                  jobWorkerOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {shortenId(profile.userId)} ({profile.location ?? "n/a"})
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              Categoria
              <select
                value={jobCategoryId}
                onChange={(event) => setJobCategoryId(event.target.value)}
                required
              >
                {availableJobCategories.length === 0 ? (
                  <option value="">Sem categoria compatível</option>
                ) : (
                  availableJobCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              Título
              <input
                type="text"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                minLength={3}
                maxLength={120}
                required
              />
            </label>
            <label>
              Descrição
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                maxLength={2000}
                minLength={10}
                required
              />
            </label>
            <label>
              Orçamento
              <input
                type="number"
                value={jobBudget}
                onChange={(event) => setJobBudget(event.target.value)}
                min={0}
                max={100_000_000}
                step={1}
                required
              />
            </label>
            <label>
              Data agendada (opcional)
              <input
                type="datetime-local"
                value={jobScheduledFor}
                onChange={(event) => setJobScheduledFor(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="primary"
              disabled={
                jobsLoading ||
                jobWorkerOptions.length === 0 ||
                availableJobCategories.length === 0
              }
            >
              {jobsLoading ? "Aguarda..." : "Criar job"}
            </button>
          </form>

          <div className="panel-grid">
            <div className="result">
              <p className="item-title">Meus jobs (cliente)</p>
              {jobsLoading && clientJobs.length === 0 ? (
                <p>A carregar jobs de cliente...</p>
              ) : visibleClientJobs.length === 0 ? (
                <p className="empty-state">
                  {jobSearch.trim().length > 0
                    ? "Nenhum job de cliente corresponde à pesquisa atual."
                    : "Ainda não tens jobs publicados. Cria o teu primeiro pedido em 2 minutos."}
                </p>
              ) : (
                visibleClientJobs.map((job) => {
                  const canCancel =
                    job.status !== "COMPLETED" && job.status !== "CANCELED";
                  return (
                    <article key={job.id} className="list-item job-card">
                      <p className="item-title">
                        {job.title}
                        <span className="status-pill is-muted">
                          {formatJobStatus(job.status)}
                        </span>
                      </p>
                      <p>
                        <strong>Orçamento:</strong> {formatCurrencyMzn(job.budget)}
                      </p>
                      <p>
                        <strong>Worker:</strong> {shortenId(job.workerProfileId)}
                      </p>
                      <p>
                        <strong>Categoria:</strong> {shortenId(job.categoryId)}
                      </p>
                      <p>
                        <strong>Criado:</strong> {formatDate(job.createdAt)}
                      </p>
                      {job.scheduledFor ? (
                        <p>
                          <strong>Agendado:</strong> {formatDate(job.scheduledFor)}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateJobStatus(job.id, "CANCELED", "client")
                        }
                        disabled={!canCancel || jobsLoading}
                      >
                        {canCancel ? "Cancelar job" : "Finalizado"}
                      </button>
                    </article>
                  );
                })
              )}
            </div>

            <div className="result">
              <p className="item-title">Jobs atribuídos a mim (worker)</p>
              {jobsLoading && workerJobs.length === 0 ? (
                <p>A carregar jobs de worker...</p>
              ) : visibleWorkerJobs.length === 0 ? (
                <p className="empty-state">
                  {jobSearch.trim().length > 0
                    ? "Nenhum job de worker corresponde à pesquisa atual."
                    : "Ainda não recebeste jobs. Mantém o perfil disponível e com categorias corretas."}
                </p>
              ) : (
                visibleWorkerJobs.map((job) => {
                  const transitions = getWorkerAllowedTransitions(job.status);
                  return (
                    <article key={job.id} className="list-item job-card">
                      <p className="item-title">
                        {job.title}
                        <span className="status-pill is-muted">
                          {formatJobStatus(job.status)}
                        </span>
                      </p>
                      <p>
                        <strong>Orçamento:</strong> {formatCurrencyMzn(job.budget)}
                      </p>
                      <p>
                        <strong>Cliente:</strong> {shortenId(job.clientId)}
                      </p>
                      <p>
                        <strong>Categoria:</strong> {shortenId(job.categoryId)}
                      </p>
                      <p>
                        <strong>Criado:</strong> {formatDate(job.createdAt)}
                      </p>
                      {job.completedAt ? (
                        <p>
                          <strong>Concluído:</strong> {formatDate(job.completedAt)}
                        </p>
                      ) : null}
                      <div
                        className="actions"
                        style={{
                          marginTop: "0.5rem",
                          gridTemplateColumns:
                            transitions.length > 1 ? "repeat(2, 1fr)" : "1fr",
                        }}
                      >
                        {transitions.length === 0 ? (
                          <button type="button" disabled>
                            Sem transições disponíveis
                          </button>
                        ) : (
                          transitions.map((nextStatus) => (
                            <button
                              key={nextStatus}
                              type="button"
                              onClick={() =>
                                handleUpdateJobStatus(job.id, nextStatus, "worker")
                              }
                              disabled={jobsLoading}
                            >
                              Marcar {formatJobStatus(nextStatus)}
                            </button>
                          ))
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section id="reviews" className="dashboard-section">
          <h2 className="section-title">Reviews</h2>
          <p className="section-lead">
            Feedback visível gera confiança. Usa linguagem objetiva e avalia só
            jobs concluídos.
          </p>
          <p className={`status status--${getStatusTone(reviewsStatus)}`}>
            {reviewsStatus}
          </p>

          <div className="section-toolbar">
            <label>
              Worker
              <select
                value={reviewWorkerProfileId}
                onChange={(event) => setReviewWorkerProfileId(event.target.value)}
              >
                {reviewWorkerOptions.length === 0 ? (
                  <option value="">Sem workers para consultar reviews</option>
                ) : (
                  reviewWorkerOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {shortenId(profile.userId)} ({profile.location ?? "n/a"})
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              Filtro rating
              <select
                value={reviewRatingFilter}
                onChange={(event) =>
                  setReviewRatingFilter(
                    event.target.value as "all" | "5" | "4" | "3" | "2" | "1",
                  )
                }
              >
                <option value="all">Todos</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </label>
            <label>
              Ordenar
              <select
                value={reviewSortMode}
                onChange={(event) =>
                  setReviewSortMode(
                    event.target.value as
                      | "createdAt:desc"
                      | "rating:desc"
                      | "rating:asc",
                  )
                }
              >
                <option value="createdAt:desc">Data (desc)</option>
                <option value="rating:desc">Rating (desc)</option>
                <option value="rating:asc">Rating (asc)</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleReloadReviews}
              disabled={reviewsLoading}
            >
              Recarregar
            </button>
          </div>

          <div className="meta-row">
            <p className="status">
              Minhas: {visibleMyReviews.length}/{myReviews.length}
            </p>
            <p className="status">
              Worker: {visibleWorkerReviews.length}/{workerReviews.length}
            </p>
            <p className="status">
              Média worker filtrado: {selectedWorkerReviewAverage}/5 (
              {formatStars(selectedWorkerReviewAverage)})
            </p>
          </div>

          <form onSubmit={handleCreateReview} className="form">
            <label>
              Job completo para avaliar
              <select
                value={reviewJobId}
                onChange={(event) => setReviewJobId(event.target.value)}
                required
              >
                {reviewableJobs.length === 0 ? (
                  <option value="">Sem jobs completos pendentes de review</option>
                ) : (
                  reviewableJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} ({shortenId(job.id)})
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              Rating
              <select
                value={reviewRating}
                onChange={(event) => setReviewRating(event.target.value)}
              >
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </label>
            <label>
              Comentário (opcional)
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                maxLength={1000}
              />
            </label>
            <button
              type="submit"
              className="primary"
              disabled={reviewsLoading || reviewableJobs.length === 0}
            >
              {reviewsLoading ? "Aguarda..." : "Publicar review"}
            </button>
          </form>

          <div className="panel-grid">
            <div className="result">
              <p className="item-title">Minhas reviews</p>
              {reviewsLoading && myReviews.length === 0 ? (
                <p>A carregar reviews...</p>
              ) : visibleMyReviews.length === 0 ? (
                <p className="empty-state">
                  {reviewRatingFilter !== "all"
                    ? "Sem reviews com esse rating."
                    : "Ainda não criaste reviews. Quando terminares um job, volta aqui para avaliar."}
                </p>
              ) : (
                visibleMyReviews.map((review) => (
                  <article key={review.id} className="list-item review-card">
                    <p className="item-title">
                      {formatStars(review.rating)} {review.rating}/5
                    </p>
                    <p>
                      <strong>Job:</strong> {shortenId(review.jobId)}
                    </p>
                    <p>
                      <strong>Worker:</strong> {shortenId(review.workerProfileId)}
                    </p>
                    <p>{review.comment ?? "Sem comentário textual."}</p>
                    <p className="muted">Criada em {formatDate(review.createdAt)}</p>
                  </article>
                ))
              )}
            </div>

            <div className="result">
              <p className="item-title">Reviews do worker selecionado</p>
              {reviewsLoading && workerReviews.length === 0 ? (
                <p>A carregar reviews do worker...</p>
              ) : visibleWorkerReviews.length === 0 ? (
                <p className="empty-state">
                  {reviewRatingFilter !== "all"
                    ? "Sem reviews do worker com esse rating."
                    : "Sem reviews para o worker selecionado. Escolhe outro worker ou remove filtros."}
                </p>
              ) : (
                visibleWorkerReviews.map((review) => (
                  <article key={review.id} className="list-item review-card">
                    <p className="item-title">
                      {formatStars(review.rating)} {review.rating}/5
                    </p>
                    <p>
                      <strong>Job:</strong> {shortenId(review.jobId)}
                    </p>
                    <p>
                      <strong>Reviewer:</strong> {shortenId(review.reviewerId)}
                    </p>
                    <p>{review.comment ?? "Sem comentário textual."}</p>
                    <p className="muted">Criada em {formatDate(review.createdAt)}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <p className="status footer-link">
          <Link href="/" className="nav-link">
            Voltar ao login
          </Link>
        </p>
      </section>
    </main>
  );
}
