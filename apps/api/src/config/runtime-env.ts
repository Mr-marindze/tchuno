const strictRuntimeEnvironments = new Set(['staging', 'pilot', 'production']);

type RuntimeEnvIssue = {
  envName: string;
  reason: string;
};

const sensitiveRequiredEnvNames = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'WEB_ORIGIN',
  'PAYMENT_WEBHOOK_SECRET',
  'PAYMENT_WEBHOOK_SECRET_MPESA',
  'PAYMENT_WEBHOOK_SECRET_EMOLA',
] as const;

const placeholderFragments = [
  'change-me',
  'replace-with',
  'replace_with',
  'replace_me',
  'example',
  'placeholder',
];

export function validateRuntimeEnvironment(): void {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').trim().toLowerCase();

  if (!strictRuntimeEnvironments.has(nodeEnv)) {
    return;
  }

  const issues = sensitiveRequiredEnvNames.flatMap((envName) =>
    validateRequiredSecret(envName, process.env[envName]),
  );

  if (issues.length > 0) {
    const details = issues
      .map((issue) => `${issue.envName}: ${issue.reason}`)
      .join('; ');

    throw new Error(
      `Unsafe runtime configuration for NODE_ENV=${nodeEnv}. ${details}`,
    );
  }
}

function validateRequiredSecret(
  envName: string,
  value: string | undefined,
): RuntimeEnvIssue[] {
  const normalized = value?.trim() ?? '';
  const issues: RuntimeEnvIssue[] = [];

  if (!normalized) {
    issues.push({ envName, reason: 'missing' });
    return issues;
  }

  const lowered = normalized.toLowerCase();
  const hasPlaceholder = placeholderFragments.some((fragment) =>
    lowered.includes(fragment),
  );

  if (hasPlaceholder) {
    issues.push({ envName, reason: 'placeholder value' });
  }

  if (envName !== 'DATABASE_URL' && envName !== 'WEB_ORIGIN') {
    const unquotedLength = normalized.replace(/^["']|["']$/g, '').length;

    if (unquotedLength < 32) {
      issues.push({ envName, reason: 'must be at least 32 characters' });
    }
  }

  return issues;
}
