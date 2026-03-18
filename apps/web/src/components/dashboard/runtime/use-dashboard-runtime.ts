"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  proposeJobQuote,
  updateJobStatus,
} from "@/lib/jobs";
import {
  createReview,
  listMyReviews,
  listWorkerReviews,
  Review,
} from "@/lib/reviews";
import {
  AdminOpsOverview,
  getAdminOpsOverview,
} from "@/lib/admin-ops";
import {
  formatCurrencyMzn,
  formatDate,
  formatJobStatus,
  formatPricingMode,
  formatRatingValue,
  formatStars,
  getStatusTone,
  shortenId,
} from "@/components/dashboard/dashboard-formatters";
import {
  getProfileCompleteness,
  getProfileReputation,
  parseLocationParts,
} from "@/components/dashboard/dashboard-profile";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ToastTone, useToast } from "@/components/toast-provider";
import { humanizeUnknownError } from "@/lib/http-errors";
import { buildJobActionPlan } from "@/lib/job-cta";
import { PaginationMeta } from "@/lib/pagination";

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

type JobFlowCounter = Record<JobStatus, number>;

function createJobFlowCounter(): JobFlowCounter {
  return {
    REQUESTED: 0,
    ACCEPTED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELED: 0,
  };
}

type JobJourneyView = "all" | "client" | "worker";

type UseDashboardRuntimeArgs = {
  view: DashboardView;
};

export function useDashboardRuntime({ view }: UseDashboardRuntimeArgs) {
  const router = useRouter();
  const { pushToast } = useToast();
  const lastToastByChannelRef = useRef<Record<string, string>>({});
  const currentDeviceId = useMemo(() => getOrCreateDeviceId(), []);
  const [state, setState] = useState<DashboardState | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [sessionsMeta, setSessionsMeta] = useState<SessionListMeta | null>(
    null,
  );
  const [statusFilter, setStatusFilter] =
    useState<SessionListQuery["status"]>("active");
  const [sort, setSort] = useState<SessionListQuery["sort"]>("lastUsedAt:desc");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("A validar sessão...");
  const [adminOpsOverview, setAdminOpsOverview] =
    useState<AdminOpsOverview | null>(null);
  const [adminOpsStatus, setAdminOpsStatus] = useState(
    "Pronto para carregar visão operacional do admin.",
  );
  const [adminOpsLoading, setAdminOpsLoading] = useState(false);
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
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(
    null,
  );
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
  const [workerProfilesMeta, setWorkerProfilesMeta] =
    useState<PaginationMeta | null>(null);
  const [workerProfilesStatus, setWorkerProfilesStatus] = useState(
    "Pronto para procurar profissionais.",
  );
  const [workerProfilesLoading, setWorkerProfilesLoading] = useState(false);
  const [workerCategorySlugFilter, setWorkerCategorySlugFilter] = useState("");
  const [workerAvailabilityFilter, setWorkerAvailabilityFilter] = useState<
    "all" | "true" | "false"
  >("all");
  const [workerLimit, setWorkerLimit] = useState(10);
  const [workerPage, setWorkerPage] = useState(1);
  const [workerSortMode, setWorkerSortMode] = useState<
    | "updatedAt:asc"
    | "updatedAt:desc"
    | "rating:asc"
    | "rating:desc"
    | "hourlyRate:asc"
    | "hourlyRate:desc"
  >("updatedAt:desc");
  const [workerSearch, setWorkerSearch] = useState("");
  const [jobsStatus, setJobsStatus] = useState("Pronto para gerir jobs.");
  const [jobsLoading, setJobsLoading] = useState(false);
  const [clientJobs, setClientJobs] = useState<Job[]>([]);
  const [clientJobsMeta, setClientJobsMeta] = useState<PaginationMeta | null>(
    null,
  );
  const [workerJobs, setWorkerJobs] = useState<Job[]>([]);
  const [workerJobsMeta, setWorkerJobsMeta] = useState<PaginationMeta | null>(
    null,
  );
  const [jobStatusFilter, setJobStatusFilter] = useState<"ALL" | JobStatus>(
    "ALL",
  );
  const [jobJourneyView, setJobJourneyView] = useState<JobJourneyView>("all");
  const [jobLimit, setJobLimit] = useState(10);
  const [jobPage, setJobPage] = useState(1);
  const [jobWorkerOptions, setJobWorkerOptions] = useState<WorkerProfile[]>([]);
  const [jobWorkerProfileId, setJobWorkerProfileId] = useState("");
  const [jobCategoryId, setJobCategoryId] = useState("");
  const [jobPricingMode, setJobPricingMode] = useState<
    "FIXED_PRICE" | "QUOTE_REQUEST"
  >("FIXED_PRICE");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobBudget, setJobBudget] = useState("");
  const [jobScheduledFor, setJobScheduledFor] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [jobSortMode, setJobSortMode] = useState<
    "createdAt:asc" | "createdAt:desc" | "budget:asc" | "budget:desc"
  >("createdAt:desc");
  const [jobQuoteDraftAmount, setJobQuoteDraftAmount] = useState<
    Record<string, string>
  >({});
  const [jobQuoteDraftMessage, setJobQuoteDraftMessage] = useState<
    Record<string, string>
  >({});
  const [reviewsStatus, setReviewsStatus] = useState(
    "Pronto para gerir reviews.",
  );
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [myReviewsMeta, setMyReviewsMeta] = useState<PaginationMeta | null>(
    null,
  );
  const [workerReviews, setWorkerReviews] = useState<Review[]>([]);
  const [workerReviewsMeta, setWorkerReviewsMeta] =
    useState<PaginationMeta | null>(null);
  const [reviewWorkerOptions, setReviewWorkerOptions] = useState<
    WorkerProfile[]
  >([]);
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
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewLimit, setReviewLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = Boolean(state?.auth.accessToken);
  const isAdmin = state?.auth.user.role === "ADMIN";
  const isHomeView = view === "home";
  const isJobsView = view === "jobs";
  const isWorkersView = view === "workers";
  const isProfileView = view === "profile";
  const isReviewsView = view === "reviews";
  const isCategoriesView = view === "categories";
  const isAdminView = view === "admin";
  const shouldLoadSessions = isProfileView;
  const shouldLoadAdminOps = isAdminView && isAdmin;
  const shouldLoadCategories = isCategoriesView || isProfileView || isJobsView;
  const shouldLoadWorkerProfile = isProfileView;
  const shouldLoadWorkerProfiles = isWorkersView;
  const shouldLoadJobs = isJobsView || isHomeView;
  const shouldLoadJobWorkerOptions = isJobsView;
  const shouldLoadReviews = isReviewsView || isHomeView || isJobsView;
  const shouldLoadReviewWorkerOptions = isReviewsView;
  const shouldLoadCompletedClientJobs =
    isReviewsView || isHomeView || isJobsView;
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  );
  const selectedJobWorkerProfile = useMemo(
    () =>
      jobWorkerOptions.find((profile) => profile.id === jobWorkerProfileId) ??
      null,
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
        Math.ceil(
          filteredSortedCategories.length / Math.max(1, categoryPageSize),
        ),
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
  const visibleWorkerProfiles = workerProfiles;
  const visibleClientJobs = clientJobs;
  const visibleWorkerJobs = workerJobs;
  const visibleMyReviews = myReviews;
  const visibleWorkerReviews = workerReviews;
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
    [
      activeCategories.length,
      availableJobCategories.length,
      jobWorkerOptions.length,
    ],
  );
  const myProfileCompleteness = useMemo(
    () => (workerProfile ? getProfileCompleteness(workerProfile) : null),
    [workerProfile],
  );
  const myProfileReputation = useMemo(
    () =>
      workerProfile
        ? getProfileReputation(
            workerProfile.ratingAvg,
            workerProfile.ratingCount,
          )
        : null,
    [workerProfile],
  );
  const myProfileLocation = useMemo(
    () => (workerProfile ? parseLocationParts(workerProfile.location) : null),
    [workerProfile],
  );
  const workerDiscoveryStats = useMemo(() => {
    const availableCount = visibleWorkerProfiles.filter(
      (profile) => profile.isAvailable,
    ).length;
    const completeCount = visibleWorkerProfiles.filter((profile) => {
      const health = getProfileCompleteness(profile);
      return health.score >= 5;
    }).length;
    const withHistoryCount = visibleWorkerProfiles.filter(
      (profile) => profile.ratingCount > 0,
    ).length;

    return {
      availableCount,
      completeCount,
      withHistoryCount,
    };
  }, [visibleWorkerProfiles]);
  const reviewableJobIdSet = useMemo(
    () => new Set(reviewableJobs.map((job) => job.id)),
    [reviewableJobs],
  );
  const clientJobFlowCounts = useMemo(() => {
    const summary = createJobFlowCounter();
    for (const job of clientJobs) {
      summary[job.status] += 1;
    }

    return summary;
  }, [clientJobs]);
  const homeAttentionItems = useMemo(() => {
    const items: Array<{
      job: Job;
      actor: "client" | "worker";
      actionLabel: string;
    }> = [];
    const seen = new Set<string>();

    for (const job of clientJobs) {
      const plan = buildJobActionPlan({
        actor: "client",
        job,
        canReview: reviewableJobIdSet.has(job.id),
      });
      const primary = plan.primary;
      const shouldHighlight =
        primary.kind === "quote" ||
        primary.kind === "review" ||
        (primary.kind === "status" && primary.nextStatus !== "CANCELED");

      if (!shouldHighlight || seen.has(job.id)) {
        continue;
      }

      seen.add(job.id);
      items.push({
        job,
        actor: "client",
        actionLabel: primary.label,
      });
    }

    for (const job of workerJobs) {
      const plan = buildJobActionPlan({
        actor: "worker",
        job,
        canReview: false,
      });
      const primary = plan.primary;
      const shouldHighlight =
        primary.kind === "quote" ||
        primary.kind === "review" ||
        (primary.kind === "status" && primary.nextStatus !== "CANCELED");

      if (!shouldHighlight || seen.has(job.id)) {
        continue;
      }

      seen.add(job.id);
      items.push({
        job,
        actor: "worker",
        actionLabel: primary.label,
      });
    }

    return items
      .sort(
        (a, b) =>
          new Date(b.job.updatedAt).getTime() - new Date(a.job.updatedAt).getTime(),
      )
      .slice(0, 6);
  }, [clientJobs, reviewableJobIdSet, workerJobs]);
  const homeJobCounts = useMemo(() => {
    const deduped = new Map<string, Job>();
    for (const job of clientJobs) {
      deduped.set(job.id, job);
    }
    for (const job of workerJobs) {
      deduped.set(job.id, job);
    }

    let inProgress = 0;
    let requested = 0;
    let pendingReview = 0;
    let canceled = 0;

    for (const job of deduped.values()) {
      if (job.status === "IN_PROGRESS") {
        inProgress += 1;
      }
      if (job.status === "REQUESTED") {
        requested += 1;
      }
      if (job.status === "CANCELED") {
        canceled += 1;
      }
    }

    pendingReview = reviewableJobs.length;

    return {
      inProgress,
      requested,
      pendingReview,
      canceled,
    };
  }, [clientJobs, reviewableJobs.length, workerJobs]);
  const homePrimaryCta = useMemo(() => {
    if (homeAttentionItems.length > 0) {
      return {
        href: "/dashboard/jobs",
        label: "Resolver jobs pendentes",
      };
    }

    if (reviewableJobs.length > 0) {
      return {
        href: "/dashboard/reviews",
        label: "Publicar reviews pendentes",
      };
    }

    return {
      href: "/dashboard/jobs",
      label: "Abrir gestão de jobs",
    };
  }, [homeAttentionItems.length, reviewableJobs.length]);
  const showClientJourney = jobJourneyView !== "worker";
  const showWorkerJourney = jobJourneyView !== "client";

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

  const loadAdminOpsData = useCallback(async (accessToken: string) => {
    const overview = await getAdminOpsOverview(accessToken);
    setAdminOpsOverview(overview);
    return overview;
  }, []);

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
      search: workerSearch.trim() || undefined,
      sort: workerSortMode,
      page: workerPage,
      limit: workerLimit,
    });
    setWorkerProfiles(result.data);
    setWorkerProfilesMeta(result.meta);
    return result;
  }, [
    workerAvailabilityFilter,
    workerCategorySlugFilter,
    workerPage,
    workerLimit,
    workerSearch,
    workerSortMode,
  ]);

  const loadJobWorkerOptions = useCallback(async () => {
    const result = await listWorkerProfiles({
      isAvailable: true,
      page: 1,
      limit: 100,
    });
    setJobWorkerOptions(result.data);
    return result;
  }, []);

  const loadJobsData = useCallback(
    async (accessToken: string) => {
      const query = {
        status: jobStatusFilter === "ALL" ? undefined : jobStatusFilter,
        search: jobSearch.trim() || undefined,
        sort: jobSortMode,
        page: jobPage,
        limit: jobLimit,
      };

      const [client, worker] = await Promise.all([
        listMyClientJobs(accessToken, query),
        listMyWorkerJobs(accessToken, query),
      ]);

      setClientJobs(client.data);
      setClientJobsMeta(client.meta);
      setWorkerJobs(worker.data);
      setWorkerJobsMeta(worker.meta);
      return { clientCount: client.meta.total, workerCount: worker.meta.total };
    },
    [jobLimit, jobPage, jobSearch, jobSortMode, jobStatusFilter],
  );

  const loadReviewWorkerOptions = useCallback(async () => {
    const result = await listWorkerProfiles({
      page: 1,
      limit: 100,
    });
    setReviewWorkerOptions(result.data);
    return result;
  }, []);

  const loadCompletedClientJobs = useCallback(async (accessToken: string) => {
    const result = await listMyClientJobs(accessToken, {
      status: "COMPLETED",
      page: 1,
      limit: 100,
    });
    setCompletedClientJobs(result.data);
    return result;
  }, []);

  const loadReviewsData = useCallback(
    async (accessToken: string) => {
      const reviewQuery = {
        rating:
          reviewRatingFilter === "all" ? undefined : Number(reviewRatingFilter),
        sort: reviewSortMode,
        page: reviewPage,
        limit: reviewLimit,
      };

      const [mine, worker] = await Promise.all([
        listMyReviews(accessToken, reviewQuery),
        reviewWorkerProfileId
          ? listWorkerReviews(reviewWorkerProfileId, reviewQuery)
          : Promise.resolve({
              data: [] as Review[],
              meta: {
                total: 0,
                page: reviewPage,
                limit: reviewLimit,
                hasNext: false,
              },
            }),
      ]);

      setMyReviews(mine.data);
      setMyReviewsMeta(mine.meta);
      setWorkerReviews(worker.data);
      setWorkerReviewsMeta(worker.meta);
      return { myCount: mine.meta.total, workerCount: worker.meta.total };
    },
    [
      reviewLimit,
      reviewPage,
      reviewRatingFilter,
      reviewSortMode,
      reviewWorkerProfileId,
    ],
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
    if (!isAuthenticated || !shouldLoadCategories) {
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
  }, [isAuthenticated, loadCategories, shouldLoadCategories]);

  useEffect(() => {
    if (!state?.auth.accessToken || !shouldLoadSessions) {
      return;
    }

    loadSessions(state.auth.accessToken).catch((error) => {
      setStatus(humanizeUnknownError(error, "Falha ao carregar sessões."));
    });
  }, [loadSessions, shouldLoadSessions, state?.auth.accessToken]);

  useEffect(() => {
    if (!state?.auth.accessToken || !shouldLoadWorkerProfile) {
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
          humanizeUnknownError(
            error,
            "Falha ao carregar o teu perfil profissional.",
          ),
        );
      })
      .finally(() => {
        setWorkerProfileLoading(false);
      });
  }, [loadMyWorkerProfileData, shouldLoadWorkerProfile, state?.auth.accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !shouldLoadWorkerProfiles) {
      return;
    }

    setWorkerProfilesLoading(true);
    loadWorkerProfilesData()
      .then((profiles) => {
        setWorkerProfilesStatus(
          profiles.meta.total > 0
            ? `Profissionais carregados. Total: ${profiles.meta.total}.`
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
  }, [isAuthenticated, loadWorkerProfilesData, shouldLoadWorkerProfiles]);

  useEffect(() => {
    if (!state?.auth.accessToken || !shouldLoadJobs) {
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
  }, [loadJobsData, shouldLoadJobs, state?.auth.accessToken]);

  useEffect(() => {
    if (!state?.auth.accessToken || !shouldLoadAdminOps) {
      setAdminOpsOverview(null);
      return;
    }

    setAdminOpsLoading(true);
    loadAdminOpsData(state.auth.accessToken)
      .then((overview) => {
        setAdminOpsStatus(
          `Painel admin carregado. Jobs: ${overview.kpis.totalJobs} | Reviews: ${overview.kpis.totalReviews}.`,
        );
      })
      .catch((error) => {
        setAdminOpsStatus(
          humanizeUnknownError(
            error,
            "Falha ao carregar visão operacional do admin.",
          ),
        );
      })
      .finally(() => {
        setAdminOpsLoading(false);
      });
  }, [loadAdminOpsData, shouldLoadAdminOps, state?.auth.accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !shouldLoadJobWorkerOptions) {
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
  }, [isAuthenticated, loadJobWorkerOptions, shouldLoadJobWorkerOptions]);

  useEffect(() => {
    if (!shouldLoadJobWorkerOptions) {
      return;
    }

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
  }, [jobWorkerOptions, jobWorkerProfileId, shouldLoadJobWorkerOptions]);

  useEffect(() => {
    if (!shouldLoadJobWorkerOptions) {
      return;
    }

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
  }, [availableJobCategories, jobCategoryId, shouldLoadJobWorkerOptions]);

  useEffect(() => {
    if (!shouldLoadCategories) {
      return;
    }

    if (categoryPage > categoryPageCount) {
      setCategoryPage(categoryPageCount);
    }
  }, [categoryPage, categoryPageCount, shouldLoadCategories]);

  useEffect(() => {
    if (!shouldLoadCategories) {
      return;
    }

    setCategoryPage(1);
  }, [categorySearch, categorySortMode, categoryPageSize, shouldLoadCategories]);

  useEffect(() => {
    if (!shouldLoadWorkerProfiles) {
      return;
    }

    setWorkerPage(1);
  }, [
    shouldLoadWorkerProfiles,
    workerAvailabilityFilter,
    workerCategorySlugFilter,
    workerLimit,
    workerSearch,
    workerSortMode,
  ]);

  useEffect(() => {
    if (!shouldLoadJobs) {
      return;
    }

    setJobPage(1);
  }, [jobLimit, jobSearch, jobSortMode, jobStatusFilter, shouldLoadJobs]);

  useEffect(() => {
    if (!shouldLoadReviews) {
      return;
    }

    setReviewPage(1);
  }, [
    reviewLimit,
    reviewRatingFilter,
    reviewSortMode,
    reviewWorkerProfileId,
    shouldLoadReviews,
  ]);

  useEffect(() => {
    if (!state?.auth.accessToken || !shouldLoadReviews) {
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
        setReviewsStatus(
          humanizeUnknownError(error, "Falha ao carregar reviews."),
        );
      })
      .finally(() => {
        setReviewsLoading(false);
      });
  }, [loadReviewsData, shouldLoadReviews, state?.auth.accessToken]);

  useEffect(() => {
    if (!state?.auth.accessToken || !shouldLoadCompletedClientJobs) {
      return;
    }

    loadCompletedClientJobs(state.auth.accessToken).catch((error) => {
      setReviewsStatus(
        humanizeUnknownError(
          error,
          "Falha ao carregar jobs completos para review.",
        ),
      );
    });
  }, [
    loadCompletedClientJobs,
    shouldLoadCompletedClientJobs,
    state?.auth.accessToken,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !shouldLoadReviewWorkerOptions) {
      return;
    }

    loadReviewWorkerOptions().catch((error) => {
      setReviewsStatus(
        humanizeUnknownError(
          error,
          "Falha ao carregar opções de worker para reviews.",
        ),
      );
    });
  }, [
    isAuthenticated,
    loadReviewWorkerOptions,
    shouldLoadReviewWorkerOptions,
  ]);

  useEffect(() => {
    if (!shouldLoadReviewWorkerOptions) {
      return;
    }

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
  }, [
    reviewWorkerOptions,
    reviewWorkerProfileId,
    shouldLoadReviewWorkerOptions,
  ]);

  useEffect(() => {
    if (!shouldLoadReviews) {
      return;
    }

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
  }, [reviewJobId, reviewableJobs, shouldLoadReviews]);

  useEffect(() => {
    pushStatusToast("global", status);
  }, [status, pushStatusToast]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    pushStatusToast("admin-ops", adminOpsStatus);
  }, [adminOpsStatus, isAdmin, pushStatusToast]);

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

  async function handleReloadAdminOps() {
    if (!isAdmin) {
      setAdminOpsStatus("Apenas admins podem abrir visão operacional.");
      return;
    }

    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setAdminOpsStatus("Access token ausente.");
      return;
    }

    setAdminOpsLoading(true);
    setAdminOpsStatus("A recarregar visão operacional...");

    try {
      const overview = await loadAdminOpsData(accessToken);
      setAdminOpsStatus(
        `Painel admin recarregado. Jobs: ${overview.kpis.totalJobs} | Reviews: ${overview.kpis.totalReviews}.`,
      );
    } catch (error) {
      setAdminOpsStatus(
        humanizeUnknownError(
          error,
          "Falha ao recarregar visão operacional do admin.",
        ),
      );
    } finally {
      setAdminOpsLoading(false);
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

    if (!isAdmin) {
      setCategoryStatus("Apenas admins podem criar categorias.");
      return;
    }

    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
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
      setCategoryStatus(
        "Descrição da categoria deve ter no máximo 280 caracteres.",
      );
      return;
    }

    const parsedSortOrder = Number(categorySortOrder);
    if (
      !Number.isInteger(parsedSortOrder) ||
      parsedSortOrder < 0 ||
      parsedSortOrder > 10_000
    ) {
      setCategoryStatus(
        "Ordem da categoria deve ser um inteiro entre 0 e 10000.",
      );
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
      setCategoryStatus(
        humanizeUnknownError(error, "Falha ao criar categoria."),
      );
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function handleDeactivateCategory(categoryId: string) {
    if (!isAdmin) {
      setCategoryStatus("Apenas admins podem desativar categorias.");
      return;
    }

    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
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
        return current.includes(categoryId)
          ? current
          : [...current, categoryId];
      }

      return current.filter((id) => id !== categoryId);
    });
  }

  async function handleReloadMyWorkerProfile() {
    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setWorkerProfileStatus("Access token ausente.");
      return;
    }

    setWorkerProfileLoading(true);
    setWorkerProfileStatus("A carregar o teu perfil profissional...");

    try {
      const profile = await loadMyWorkerProfileData(accessToken);
      setWorkerProfileStatus(
        profile
          ? "Perfil profissional recarregado."
          : "Ainda não tens perfil profissional.",
      );
    } catch (error) {
      setWorkerProfileStatus(
        humanizeUnknownError(
          error,
          "Falha ao carregar o teu perfil profissional.",
        ),
      );
    } finally {
      setWorkerProfileLoading(false);
    }
  }

  async function handleSaveWorkerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
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
        setWorkerProfileStatus(
          "Tarifa por hora deve ser um inteiro entre 0 e 1000000.",
        );
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
        setWorkerProfileStatus(
          "Anos de experiência deve ser um inteiro entre 0 e 80.",
        );
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

    const activeCategoryIdSet = new Set(
      activeCategories.map((item) => item.id),
    );
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
        profiles.meta.total > 0
          ? `Profissionais recarregados. Total: ${profiles.meta.total}.`
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
    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
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

    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
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

    if (
      normalizedDescription.length < 10 ||
      normalizedDescription.length > 2000
    ) {
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

    const normalizedBudget = jobBudget.trim();
    let parsedBudget: number | undefined;
    if (jobPricingMode === "FIXED_PRICE") {
      if (normalizedBudget.length === 0) {
        setJobsStatus("Orçamento é obrigatório para jobs de preço fixo.");
        return;
      }

      parsedBudget = Number(normalizedBudget);
      if (
        !Number.isInteger(parsedBudget) ||
        parsedBudget <= 0 ||
        parsedBudget > 100_000_000
      ) {
        setJobsStatus("Orçamento deve ser um inteiro entre 1 e 100000000.");
        return;
      }
    } else if (normalizedBudget.length > 0) {
      parsedBudget = Number(normalizedBudget);
      if (
        !Number.isInteger(parsedBudget) ||
        parsedBudget < 0 ||
        parsedBudget > 100_000_000
      ) {
        setJobsStatus(
          "No modo de cotação, orçamento opcional deve ser inteiro entre 0 e 100000000.",
        );
        return;
      }
    }

    let scheduledForIso: string | undefined;
    if (jobScheduledFor.trim().length > 0) {
      const parsedDate = new Date(jobScheduledFor);
      if (Number.isNaN(parsedDate.getTime())) {
        setJobsStatus("Data agendada inválida.");
        return;
      }
      if (parsedDate.getTime() <= Date.now()) {
        setJobsStatus("A data agendada deve ser futura.");
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
        pricingMode: jobPricingMode,
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
    options?: {
      quotedAmount?: number;
      cancelReason?: string;
    },
  ) {
    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setJobsStatus("Access token ausente.");
      return;
    }

    setJobsLoading(true);
    setJobsStatus(
      `A atualizar job (${roleLabel}) para ${formatJobStatus(nextStatus)}...`,
    );

    try {
      await updateJobStatus(accessToken, jobId, nextStatus, options);
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

  async function handleProposeQuote(jobId: string) {
    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setJobsStatus("Access token ausente.");
      return;
    }

    const amountRaw = (jobQuoteDraftAmount[jobId] ?? "").trim();
    const parsedAmount = Number(amountRaw);
    if (
      amountRaw.length === 0 ||
      !Number.isInteger(parsedAmount) ||
      parsedAmount <= 0 ||
      parsedAmount > 100_000_000
    ) {
      setJobsStatus("Proposta deve ser um inteiro entre 1 e 100000000.");
      return;
    }

    const message = (jobQuoteDraftMessage[jobId] ?? "").trim();
    if (message.length > 280) {
      setJobsStatus("Mensagem da proposta deve ter no máximo 280 caracteres.");
      return;
    }

    setJobsLoading(true);
    setJobsStatus("A enviar proposta...");

    try {
      await proposeJobQuote(accessToken, jobId, {
        quotedAmount: parsedAmount,
        quoteMessage: message || undefined,
      });
      const { clientCount, workerCount } = await loadJobsData(accessToken);
      setJobsStatus(
        `Proposta enviada com sucesso. Cliente: ${clientCount} | Worker: ${workerCount}.`,
      );
    } catch (error) {
      setJobsStatus(
        humanizeUnknownError(error, "Falha ao enviar proposta de cotação."),
      );
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleReloadReviews() {
    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
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
        `Reviews recarregadas. Minhas: ${myCount} | Worker selecionado: ${workerCount} | Jobs completos: ${reviewJobs.meta.total}.`,
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

    const accessToken =
      state?.auth.accessToken ?? getStoredTokens().accessToken;
    if (!accessToken) {
      setReviewsStatus("Access token ausente.");
      return;
    }

    if (!reviewJobId) {
      setReviewsStatus("Seleciona um job completo para avaliar.");
      return;
    }

    const canReviewSelectedJob = reviewableJobs.some(
      (job) => job.id === reviewJobId,
    );
    if (!canReviewSelectedJob) {
      setReviewsStatus(
        "Este job já foi avaliado ou não está elegível para review.",
      );
      return;
    }

    const parsedRating = Number(reviewRating);
    if (
      !Number.isInteger(parsedRating) ||
      parsedRating < 1 ||
      parsedRating > 5
    ) {
      setReviewsStatus("Rating deve ser um inteiro entre 1 e 5.");
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
        `Review criada com sucesso. Minhas: ${myCount} | Worker selecionado: ${workerCount} | Jobs completos: ${reviewJobs.meta.total}.`,
      );
    } catch (error) {
      setReviewsStatus(humanizeUnknownError(error, "Falha ao criar review."));
    } finally {
      setReviewsLoading(false);
    }
  }

  const shellProps = {
    status,
    statusTone: getStatusTone(status),
    onRefreshNow: handleRefreshNow,
    onLogout: handleLogout,
    onLogoutAll: handleLogoutAll,
  } as const;

  const homeProps = {
    homeAttentionItems,
    homeJobCounts,
    homePrimaryCta,
    formatJobStatus,
    formatDate,
  } as const;

  const adminProps = {
    adminOpsStatus,
    adminOpsLoading,
    adminOpsOverview,
    onReload: handleReloadAdminOps,
    getStatusTone,
    jobStatuses,
    formatJobStatus,
    formatPricingMode,
    formatCurrencyMzn,
    formatDate,
    shortenId,
  } as const;

  const fallbackDebugUser: AuthResponse["user"] = {
    id: "",
    email: "",
    name: null,
    role: "USER",
  };

  const profileProps = {
    debugData: state
      ? {
          me: state.me,
          user: state.auth.user,
          accessTokenPreview: `${state.auth.accessToken.slice(0, 24)}...`,
          refreshTokenPreview: `${state.auth.refreshToken.slice(0, 24)}...`,
        }
      : {
          me: null,
          user: fallbackDebugUser,
          accessTokenPreview: "",
          refreshTokenPreview: "",
        },
    getStatusTone,
    statusFilter,
    onStatusFilterChange: (value: SessionListQuery["status"]) => {
      setOffset(0);
      setStatusFilter(value);
    },
    sort,
    onSortChange: setSort,
    limit,
    onLimitChange: (value: number) => {
      setOffset(0);
      setLimit(value);
    },
    sessionsMeta,
    sessions,
    currentDeviceId,
    onReloadSessions: handleReloadSessions,
    onPreviousSessionsPage: () =>
      setOffset((current) => Math.max(0, current - limit)),
    onNextSessionsPage: () => setOffset((current) => current + limit),
    canGoToPreviousSessionsPage: Boolean(sessionsMeta?.hasPrev),
    canGoToNextSessionsPage: Boolean(sessionsMeta?.hasNext),
    onRevokeSession: handleRevokeSession,
    workerProfileStatus,
    workerProfileLoading,
    onReloadWorkerProfile: handleReloadMyWorkerProfile,
    profileIsAvailable,
    onProfileIsAvailableChange: setProfileIsAvailable,
    workerProfile,
    myProfileCompleteness,
    myProfileReputation,
    myProfileLocation,
    onSaveWorkerProfile: handleSaveWorkerProfile,
    profileBio,
    onProfileBioChange: setProfileBio,
    profileLocation,
    onProfileLocationChange: setProfileLocation,
    profileHourlyRate,
    onProfileHourlyRateChange: setProfileHourlyRate,
    profileExperienceYears,
    onProfileExperienceYearsChange: setProfileExperienceYears,
    activeCategories,
    profileCategoryIds,
    onToggleProfileCategory: toggleProfileCategory,
    formatCurrencyMzn,
    formatStars,
    formatRatingValue,
    formatDate,
    shortenId,
  } as const;

  const categoriesProps = {
    categoryStatus,
    getStatusTone,
    isAdmin,
    includeInactive,
    onIncludeInactiveChange: setIncludeInactive,
    categorySearch,
    onCategorySearchChange: setCategorySearch,
    categorySortMode,
    onCategorySortModeChange: setCategorySortMode,
    categoryPageSize,
    onCategoryPageSizeChange: setCategoryPageSize,
    onReloadCategories: handleReloadCategories,
    categoriesLoading,
    onCategoryPreviousPage: () =>
      setCategoryPage((current) => Math.max(1, current - 1)),
    onCategoryNextPage: () =>
      setCategoryPage((current) => Math.min(categoryPageCount, current + 1)),
    categoryPage,
    categoryPageCount,
    categoriesCount: categories.length,
    totalActiveCategories: categories.filter((category) => category.isActive)
      .length,
    totalInactiveCategories: categories.filter((category) => !category.isActive)
      .length,
    visibleCategories,
    totalFilteredCategories: filteredSortedCategories.length,
    onCreateCategory: handleCreateCategory,
    categoryName,
    onCategoryNameChange: setCategoryName,
    categorySlug,
    onCategorySlugChange: setCategorySlug,
    categoryDescription,
    onCategoryDescriptionChange: setCategoryDescription,
    categorySortOrder,
    onCategorySortOrderChange: setCategorySortOrder,
    onDeactivateCategory: handleDeactivateCategory,
    formatDate,
  } as const;

  const workersProps = {
    workerProfilesStatus,
    getStatusTone,
    workerCategorySlugFilter,
    onWorkerCategorySlugFilterChange: (value: string) => {
      setWorkerPage(1);
      setWorkerCategorySlugFilter(value);
    },
    activeCategories,
    workerAvailabilityFilter,
    onWorkerAvailabilityFilterChange: (value: "all" | "true" | "false") => {
      setWorkerPage(1);
      setWorkerAvailabilityFilter(value);
    },
    workerLimit,
    onWorkerLimitChange: (value: number) => {
      setWorkerPage(1);
      setWorkerLimit(value);
    },
    workerSearch,
    onWorkerSearchChange: (value: string) => {
      setWorkerPage(1);
      setWorkerSearch(value);
    },
    workerSortMode,
    onWorkerSortModeChange: (
      value:
        | "updatedAt:asc"
        | "updatedAt:desc"
        | "rating:asc"
        | "rating:desc"
        | "hourlyRate:asc"
        | "hourlyRate:desc",
    ) => {
      setWorkerPage(1);
      setWorkerSortMode(value);
    },
    onReloadWorkerProfiles: handleReloadWorkerProfiles,
    workerProfilesLoading,
    onWorkerPreviousPage: () =>
      setWorkerPage((current) => Math.max(1, current - 1)),
    onWorkerNextPage: () => setWorkerPage((current) => current + 1),
    workerPage,
    workerProfilesMeta,
    visibleWorkerProfiles,
    workerDiscoveryStats,
    currentUserId: state?.auth.user.id ?? "",
    getProfileCompleteness,
    getProfileReputation,
    formatStars,
    formatRatingValue,
    formatCurrencyMzn,
    formatDate,
    shortenId,
  } as const;

  const jobsProps = {
    jobsStatus,
    getStatusTone,
    clientJobFlowCounts,
    reviewableJobs,
    jobCreationChecklist,
    selectedJobWorkerProfile,
    availableJobCategories,
    jobStatuses,
    jobStatusFilter,
    onJobStatusFilterChange: (value: "ALL" | JobStatus) => {
      setJobPage(1);
      setJobStatusFilter(value);
    },
    jobLimit,
    onJobLimitChange: (value: number) => {
      setJobPage(1);
      setJobLimit(value);
    },
    jobSearch,
    onJobSearchChange: (value: string) => {
      setJobPage(1);
      setJobSearch(value);
    },
    jobSortMode,
    onJobSortModeChange: (
      value: "createdAt:asc" | "createdAt:desc" | "budget:asc" | "budget:desc",
    ) => {
      setJobPage(1);
      setJobSortMode(value);
    },
    onReloadJobs: handleReloadJobs,
    jobsLoading,
    onJobPreviousPage: () => setJobPage((current) => Math.max(1, current - 1)),
    onJobNextPage: () => setJobPage((current) => current + 1),
    jobPage,
    clientJobsMeta,
    workerJobsMeta,
    visibleClientJobs,
    visibleWorkerJobs,
    onCreateJob: handleCreateJob,
    jobWorkerProfileId,
    onJobWorkerProfileIdChange: setJobWorkerProfileId,
    jobWorkerOptions,
    jobCategoryId,
    onJobCategoryIdChange: setJobCategoryId,
    jobPricingMode,
    onJobPricingModeChange: setJobPricingMode,
    jobTitle,
    onJobTitleChange: setJobTitle,
    jobDescription,
    onJobDescriptionChange: setJobDescription,
    jobBudget,
    onJobBudgetChange: setJobBudget,
    jobScheduledFor,
    onJobScheduledForChange: setJobScheduledFor,
    jobJourneyView,
    onJobJourneyViewChange: setJobJourneyView,
    showClientJourney,
    showWorkerJourney,
    reviewableJobIdSet,
    onUpdateJobStatus: handleUpdateJobStatus,
    jobQuoteDraftAmount,
    onJobQuoteDraftAmountChange: (jobId: string, value: string) =>
      setJobQuoteDraftAmount((current) => ({
        ...current,
        [jobId]: value,
      })),
    jobQuoteDraftMessage,
    onJobQuoteDraftMessageChange: (jobId: string, value: string) =>
      setJobQuoteDraftMessage((current) => ({
        ...current,
        [jobId]: value,
      })),
    onProposeQuote: handleProposeQuote,
    onGoToReviewJob: (jobId: string) => {
      setReviewJobId(jobId);
      if (typeof document !== "undefined") {
        document
          .getElementById("reviews")
          ?.scrollIntoView({ behavior: "smooth" });
      }
    },
    formatJobStatus,
    formatCurrencyMzn,
    shortenId,
    formatDate,
  } as const;

  const reviewsProps = {
    reviewsStatus,
    getStatusTone,
    completedClientJobs,
    myReviews,
    myReviewsMeta,
    reviewableJobs,
    reviewWorkerOptions,
    reviewWorkerProfileId,
    onReviewWorkerProfileIdChange: (value: string) => {
      setReviewPage(1);
      setReviewWorkerProfileId(value);
    },
    reviewRatingFilter,
    onReviewRatingFilterChange: (value: "all" | "5" | "4" | "3" | "2" | "1") => {
      setReviewPage(1);
      setReviewRatingFilter(value);
    },
    reviewLimit,
    onReviewLimitChange: (value: number) => {
      setReviewPage(1);
      setReviewLimit(value);
    },
    reviewSortMode,
    onReviewSortModeChange: (value: "createdAt:desc" | "rating:desc" | "rating:asc") => {
      setReviewPage(1);
      setReviewSortMode(value);
    },
    onReloadReviews: handleReloadReviews,
    reviewsLoading,
    reviewPage,
    onReviewPreviousPage: () =>
      setReviewPage((current) => Math.max(1, current - 1)),
    onReviewNextPage: () => setReviewPage((current) => current + 1),
    workerReviewsMeta,
    visibleMyReviews,
    visibleWorkerReviews,
    selectedWorkerReviewAverage,
    onCreateReview: handleCreateReview,
    reviewJobId,
    onReviewJobIdChange: setReviewJobId,
    reviewRating,
    onReviewRatingChange: setReviewRating,
    reviewComment,
    onReviewCommentChange: setReviewComment,
    formatStars,
    shortenId,
    formatDate,
  } as const;

  return {
    loading,
    state,
    isAuthenticated,
    isAdmin,
    isHomeView,
    isJobsView,
    isWorkersView,
    isProfileView,
    isReviewsView,
    isCategoriesView,
    isAdminView,
    shellProps,
    homeProps,
    adminProps,
    profileProps,
    categoriesProps,
    workersProps,
    jobsProps,
    reviewsProps,
  };
}
