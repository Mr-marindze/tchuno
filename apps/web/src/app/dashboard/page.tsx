"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

export default function DashboardPage() {
  const router = useRouter();
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
          error instanceof Error ? error.message : "Falha ao carregar categorias.",
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
      setStatus(error instanceof Error ? error.message : "Falha ao carregar sessões.");
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
          error instanceof Error
            ? error.message
            : "Falha ao carregar o teu perfil profissional.",
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
          error instanceof Error
            ? error.message
            : "Falha ao listar perfis profissionais.",
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
        setJobsStatus(
          error instanceof Error ? error.message : "Falha ao carregar jobs.",
        );
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
        error instanceof Error
          ? error.message
          : "Falha ao carregar opções de profissionais para criar job.",
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
        setReviewsStatus(
          error instanceof Error ? error.message : "Falha ao carregar reviews.",
        );
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
        error instanceof Error
          ? error.message
          : "Falha ao carregar jobs completos para review.",
      );
    });
  }, [state?.auth.accessToken, loadCompletedClientJobs]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadReviewWorkerOptions().catch((error) => {
      setReviewsStatus(
        error instanceof Error
          ? error.message
          : "Falha ao carregar opções de worker para reviews.",
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
      setStatus(error instanceof Error ? error.message : "Falha no refresh.");
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
      setStatus(error instanceof Error ? error.message : "Falha ao revogar sessão.");
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
      setStatus(error instanceof Error ? error.message : "Falha ao carregar sessões.");
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
        error instanceof Error ? error.message : "Falha ao carregar categorias.",
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
        name: categoryName.trim(),
        slug: categorySlug.trim() || undefined,
        description: categoryDescription.trim() || undefined,
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
        error instanceof Error ? error.message : "Falha ao criar categoria.",
      );
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
        error instanceof Error ? error.message : "Falha ao desativar categoria.",
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
        error instanceof Error
          ? error.message
          : "Falha ao carregar o teu perfil profissional.",
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

    const activeCategoryIdSet = new Set(activeCategories.map((item) => item.id));
    const validCategoryIds = profileCategoryIds.filter((id) =>
      activeCategoryIdSet.has(id),
    );

    setWorkerProfileLoading(true);
    setWorkerProfileStatus("A guardar perfil profissional...");

    try {
      const savedProfile = await upsertMyWorkerProfile(accessToken, {
        bio: profileBio.trim() || undefined,
        location: profileLocation.trim() || undefined,
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
        error instanceof Error ? error.message : "Falha ao guardar perfil profissional.",
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
        error instanceof Error ? error.message : "Falha ao listar perfis profissionais.",
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
      setJobsStatus(error instanceof Error ? error.message : "Falha ao recarregar jobs.");
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
        title: jobTitle.trim(),
        description: jobDescription.trim(),
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
      setJobsStatus(error instanceof Error ? error.message : "Falha ao criar job.");
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
        error instanceof Error ? error.message : "Falha ao atualizar status do job.",
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
        error instanceof Error ? error.message : "Falha ao recarregar reviews.",
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

    const parsedRating = Number(reviewRating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      setReviewsStatus("rating deve ser inteiro entre 1 e 5.");
      return;
    }

    setReviewsLoading(true);
    setReviewsStatus("A criar review...");

    try {
      await createReview(accessToken, {
        jobId: reviewJobId,
        rating: parsedRating,
        comment: reviewComment.trim() || undefined,
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
      setReviewsStatus(error instanceof Error ? error.message : "Falha ao criar review.");
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

  return (
    <main className="shell">
      <section className="card">
        <header className="header">
          <p className="kicker">Tchuno Dashboard</p>
          <h1>Área Protegida</h1>
          <p className="subtitle">Somente para utilizadores autenticados.</p>
        </header>

        <div className="actions" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={handleRefreshNow}>
            Refresh Agora
          </button>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
          <button type="button" onClick={handleLogoutAll}>
            Logout All
          </button>
        </div>

        <p className="status">Status: {status}</p>

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

        <h2 style={{ marginTop: "1rem", fontWeight: 700 }}>Dispositivos/Sessões</h2>
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
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
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SessionListQuery["sort"])}
          >
            <option value="lastUsedAt:desc">Último uso (desc)</option>
            <option value="lastUsedAt:asc">Último uso (asc)</option>
            <option value="createdAt:desc">Criação (desc)</option>
            <option value="createdAt:asc">Criação (asc)</option>
          </select>
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
          <button type="button" onClick={handleReloadSessions}>
            Recarregar
          </button>
        </div>
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
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
            Página atual: {sessionsMeta?.page ?? 1} / {sessionsMeta?.pageCount ?? 1}
          </p>
        </div>
        <div className="result">
          {sessions.length === 0 ? (
            <p>Sem sessões registadas.</p>
          ) : (
            sessions.map((session) => {
              const isCurrentDevice = session.deviceId === currentDeviceId;
              const isRevoked = Boolean(session.revokedAt);

              return (
                <div key={session.id} style={{ marginBottom: "0.8rem", borderBottom: "1px solid rgba(186,230,253,0.2)", paddingBottom: "0.7rem" }}>
                  <p>
                    <strong>deviceId:</strong> {session.deviceId}{" "}
                    {isCurrentDevice ? "(dispositivo atual)" : ""}
                  </p>
                  <p><strong>ip:</strong> {session.ip ?? "n/a"}</p>
                  <p><strong>createdAt:</strong> {formatDate(session.createdAt)}</p>
                  <p><strong>lastUsedAt:</strong> {formatDate(session.lastUsedAt)}</p>
                  <p><strong>status:</strong> {isRevoked ? "revogada" : "ativa"}</p>
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={isRevoked || isCurrentDevice}
                  >
                    {isCurrentDevice ? "Sessão atual" : "Revogar sessão"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <h2 style={{ marginTop: "1rem", fontWeight: 700 }}>Categorias (MVP)</h2>
        <p className="status">{categoryStatus}</p>

        <div
          className="actions"
          style={{
            marginBottom: "0.8rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6rem",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Incluir inativas
          </label>
          <button
            type="button"
            onClick={handleReloadCategories}
            disabled={categoriesLoading}
          >
            Recarregar categorias
          </button>
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
          {categories.length === 0 ? (
            <p>Sem categorias registadas.</p>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                style={{
                  marginBottom: "0.8rem",
                  borderBottom: "1px solid rgba(186,230,253,0.2)",
                  paddingBottom: "0.7rem",
                }}
              >
                <p>
                  <strong>{category.name}</strong> ({category.slug})
                </p>
                {category.description ? <p>{category.description}</p> : null}
                <p>
                  <strong>estado:</strong>{" "}
                  {category.isActive ? "ativa" : "inativa"}
                </p>
                <p>
                  <strong>ordem:</strong> {category.sortOrder}
                </p>
                <p>
                  <strong>updatedAt:</strong> {formatDate(category.updatedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => handleDeactivateCategory(category.id)}
                  disabled={categoriesLoading || !category.isActive}
                >
                  {category.isActive ? "Desativar categoria" : "Inativa"}
                </button>
              </div>
            ))
          )}
        </div>

        <h2 style={{ marginTop: "1rem", fontWeight: 700 }}>
          WorkerProfile (Meu Perfil)
        </h2>
        <p className="status">{workerProfileStatus}</p>
        <div
          className="actions"
          style={{
            marginBottom: "0.8rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6rem",
          }}
        >
          <button
            type="button"
            onClick={handleReloadMyWorkerProfile}
            disabled={workerProfileLoading}
          >
            Recarregar meu perfil
          </button>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 600,
            }}
          >
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
            <input
              type="text"
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
            <p style={{ marginTop: 0, fontWeight: 700 }}>Categorias ativas</p>
            {activeCategories.length === 0 ? (
              <p>Sem categorias ativas. Cria categorias antes de guardar o perfil.</p>
            ) : (
              activeCategories.map((category) => (
                <label
                  key={category.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={profileCategoryIds.includes(category.id)}
                    onChange={(event) =>
                      toggleProfileCategory(category.id, event.target.checked)
                    }
                  />
                  {category.name} ({category.slug})
                </label>
              ))
            )}
          </div>

          <button type="submit" className="primary" disabled={workerProfileLoading}>
            {workerProfileLoading ? "Aguarda..." : "Guardar perfil profissional"}
          </button>
        </form>

        <div className="result">
          {workerProfile ? (
            <pre style={{ margin: 0 }}>
              {JSON.stringify(
                {
                  id: workerProfile.id,
                  userId: workerProfile.userId,
                  isAvailable: workerProfile.isAvailable,
                  ratingAvg: workerProfile.ratingAvg,
                  ratingCount: workerProfile.ratingCount,
                  categories: workerProfile.categories.map((item) => item.slug),
                  updatedAt: workerProfile.updatedAt,
                },
                null,
                2,
              )}
            </pre>
          ) : (
            <p>Ainda não tens WorkerProfile criado.</p>
          )}
        </div>

        <h2 style={{ marginTop: "1rem", fontWeight: 700 }}>
          WorkerProfile (Descoberta Pública)
        </h2>
        <p className="status">{workerProfilesStatus}</p>
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
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
          <button
            type="button"
            onClick={handleReloadWorkerProfiles}
            disabled={workerProfilesLoading}
          >
            Recarregar profissionais
          </button>
        </div>
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
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
          <p className="status">
            Página atual: {Math.floor(workerOffset / workerLimit) + 1}
          </p>
        </div>
        <div className="result">
          {workerProfiles.length === 0 ? (
            <p>Sem perfis para os filtros escolhidos.</p>
          ) : (
            workerProfiles.map((profile) => {
              const isMe = profile.userId === state.auth.user.id;
              return (
                <div
                  key={profile.id}
                  style={{
                    marginBottom: "0.8rem",
                    borderBottom: "1px solid rgba(186,230,253,0.2)",
                    paddingBottom: "0.7rem",
                  }}
                >
                  <p>
                    <strong>userId:</strong> {profile.userId}{" "}
                    {isMe ? "(meu perfil)" : ""}
                  </p>
                  <p>
                    <strong>estado:</strong>{" "}
                    {profile.isAvailable ? "disponível" : "indisponível"}
                  </p>
                  <p>
                    <strong>localização:</strong> {profile.location ?? "n/a"}
                  </p>
                  <p>
                    <strong>tarifa/hora:</strong>{" "}
                    {typeof profile.hourlyRate === "number"
                      ? profile.hourlyRate
                      : "n/a"}
                  </p>
                  <p>
                    <strong>experiência:</strong> {profile.experienceYears} anos
                  </p>
                  <p>
                    <strong>rating:</strong> {profile.ratingAvg} ({profile.ratingCount})
                  </p>
                  <p>
                    <strong>categorias:</strong>{" "}
                    {profile.categories.length > 0
                      ? profile.categories.map((item) => item.name).join(", ")
                      : "n/a"}
                  </p>
                  <p>
                    <strong>updatedAt:</strong> {formatDate(profile.updatedAt)}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <h2 style={{ marginTop: "1rem", fontWeight: 700 }}>Jobs (MVP)</h2>
        <p className="status">{jobsStatus}</p>
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
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
          <button type="button" onClick={handleReloadJobs} disabled={jobsLoading}>
            Recarregar jobs
          </button>
        </div>
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
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
          <p className="status">Página atual: {Math.floor(jobOffset / jobLimit) + 1}</p>
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
                    {profile.userId} ({profile.location ?? "n/a"})
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
            <input
              type="text"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              minLength={10}
              maxLength={2000}
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

        <div className="result">
          <p style={{ marginTop: 0, fontWeight: 700 }}>Meus jobs (cliente)</p>
          {clientJobs.length === 0 ? (
            <p>Sem jobs como cliente para os filtros atuais.</p>
          ) : (
            clientJobs.map((job) => {
              const canCancel =
                job.status !== "COMPLETED" && job.status !== "CANCELED";
              return (
                <div
                  key={job.id}
                  style={{
                    marginBottom: "0.8rem",
                    borderBottom: "1px solid rgba(186,230,253,0.2)",
                    paddingBottom: "0.7rem",
                  }}
                >
                  <p>
                    <strong>{job.title}</strong> ({formatJobStatus(job.status)})
                  </p>
                  <p>
                    <strong>budget:</strong> {job.budget}
                  </p>
                  <p>
                    <strong>workerProfileId:</strong> {job.workerProfileId}
                  </p>
                  <p>
                    <strong>categoryId:</strong> {job.categoryId}
                  </p>
                  <p>
                    <strong>createdAt:</strong> {formatDate(job.createdAt)}
                  </p>
                  {job.scheduledFor ? (
                    <p>
                      <strong>scheduledFor:</strong> {formatDate(job.scheduledFor)}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleUpdateJobStatus(job.id, "CANCELED", "client")}
                    disabled={!canCancel || jobsLoading}
                  >
                    {canCancel ? "Cancelar job" : "Finalizado"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="result">
          <p style={{ marginTop: 0, fontWeight: 700 }}>
            Jobs atribuídos a mim (worker)
          </p>
          {workerJobs.length === 0 ? (
            <p>Sem jobs como worker para os filtros atuais.</p>
          ) : (
            workerJobs.map((job) => {
              const transitions = getWorkerAllowedTransitions(job.status);

              return (
                <div
                  key={job.id}
                  style={{
                    marginBottom: "0.8rem",
                    borderBottom: "1px solid rgba(186,230,253,0.2)",
                    paddingBottom: "0.7rem",
                  }}
                >
                  <p>
                    <strong>{job.title}</strong> ({formatJobStatus(job.status)})
                  </p>
                  <p>
                    <strong>budget:</strong> {job.budget}
                  </p>
                  <p>
                    <strong>clientId:</strong> {job.clientId}
                  </p>
                  <p>
                    <strong>categoryId:</strong> {job.categoryId}
                  </p>
                  <p>
                    <strong>createdAt:</strong> {formatDate(job.createdAt)}
                  </p>
                  {job.completedAt ? (
                    <p>
                      <strong>completedAt:</strong> {formatDate(job.completedAt)}
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
                </div>
              );
            })
          )}
        </div>

        <h2 style={{ marginTop: "1rem", fontWeight: 700 }}>Reviews (MVP)</h2>
        <p className="status">{reviewsStatus}</p>
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
          <select
            value={reviewWorkerProfileId}
            onChange={(event) => setReviewWorkerProfileId(event.target.value)}
          >
            {reviewWorkerOptions.length === 0 ? (
              <option value="">Sem workers para consultar reviews</option>
            ) : (
              reviewWorkerOptions.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.userId} ({profile.location ?? "n/a"})
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={handleReloadReviews}
            disabled={reviewsLoading}
          >
            Recarregar reviews
          </button>
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
                    {job.title} ({job.id.slice(0, 8)}...)
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
            <input
              type="text"
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
            {reviewsLoading ? "Aguarda..." : "Criar review"}
          </button>
        </form>

        <div className="result">
          <p style={{ marginTop: 0, fontWeight: 700 }}>Minhas reviews</p>
          {myReviews.length === 0 ? (
            <p>Ainda não criaste reviews.</p>
          ) : (
            myReviews.map((review) => (
              <div
                key={review.id}
                style={{
                  marginBottom: "0.8rem",
                  borderBottom: "1px solid rgba(186,230,253,0.2)",
                  paddingBottom: "0.7rem",
                }}
              >
                <p>
                  <strong>jobId:</strong> {review.jobId}
                </p>
                <p>
                  <strong>workerProfileId:</strong> {review.workerProfileId}
                </p>
                <p>
                  <strong>rating:</strong> {review.rating}/5
                </p>
                <p>
                  <strong>comment:</strong> {review.comment ?? "n/a"}
                </p>
                <p>
                  <strong>createdAt:</strong> {formatDate(review.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="result">
          <p style={{ marginTop: 0, fontWeight: 700 }}>
            Reviews do worker selecionado
          </p>
          {workerReviews.length === 0 ? (
            <p>Sem reviews para o worker selecionado.</p>
          ) : (
            workerReviews.map((review) => (
              <div
                key={review.id}
                style={{
                  marginBottom: "0.8rem",
                  borderBottom: "1px solid rgba(186,230,253,0.2)",
                  paddingBottom: "0.7rem",
                }}
              >
                <p>
                  <strong>jobId:</strong> {review.jobId}
                </p>
                <p>
                  <strong>reviewerId:</strong> {review.reviewerId}
                </p>
                <p>
                  <strong>rating:</strong> {review.rating}/5
                </p>
                <p>
                  <strong>comment:</strong> {review.comment ?? "n/a"}
                </p>
                <p>
                  <strong>createdAt:</strong> {formatDate(review.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>

        <p className="status">
          <Link href="/" className="nav-link">
            Voltar ao login
          </Link>
        </p>
      </section>
    </main>
  );
}
