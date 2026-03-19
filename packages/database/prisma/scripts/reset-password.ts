import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

type CliOptions = {
  email?: string;
  password?: string;
  actorEmail?: string;
  reason?: string;
  dryRun: boolean;
  help: boolean;
};

const prisma = new PrismaClient();

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case '--email':
        options.email = next;
        index += 1;
        break;
      case '--password':
        options.password = next;
        index += 1;
        break;
      case '--actor-email':
        options.actorEmail = next;
        index += 1;
        break;
      case '--reason':
        options.reason = next;
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Argumento não suportado: ${token}`);
    }
  }

  return options;
}

function printUsage(): void {
  console.log(`
Uso:
  yarn workspace @tchuno/database reset-password --email <email> [opções]

Opções:
  --password <senha>       Define senha temporária manualmente
  --actor-email <email>    Email do operador (admin) para auditoria
  --reason <texto>         Motivo da operação (default: assisted_password_reset)
  --dry-run                Simula operação sem gravar
  --help, -h               Mostra esta ajuda

Exemplos:
  yarn workspace @tchuno/database reset-password --email client1@tchuno.local
  yarn workspace @tchuno/database reset-password --email user@tchuno.local --password 'Temp2026x9'
  yarn workspace @tchuno/database reset-password --email user@tchuno.local --actor-email admin@tchuno.local --reason "ticket-142"
`);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isPasswordStrong(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 72 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

function generateTemporaryPassword(): string {
  const random = randomBytes(8).toString('base64url');
  return `Tmp${random}9a`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (!options.email) {
    throw new Error('Parâmetro obrigatório: --email');
  }

  const email = normalizeEmail(options.email);
  const reason = (options.reason ?? 'assisted_password_reset').trim();
  const generatedPassword = !options.password;
  const nextPassword = options.password ?? generateTemporaryPassword();

  if (!isPasswordStrong(nextPassword)) {
    throw new Error(
      'Senha inválida. Usa 8-72 caracteres com pelo menos uma letra e um número.',
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!targetUser) {
    throw new Error(`Utilizador não encontrado: ${email}`);
  }

  const actorEmail = options.actorEmail
    ? normalizeEmail(options.actorEmail)
    : null;

  const actorUser = actorEmail
    ? await prisma.user.findUnique({
        where: { email: actorEmail },
        select: {
          id: true,
          email: true,
          role: true,
          adminSubrole: true,
        },
      })
    : null;

  if (actorEmail && !actorUser) {
    throw new Error(`Operador não encontrado: ${actorEmail}`);
  }

  if (actorUser && actorUser.role !== 'ADMIN') {
    throw new Error(
      `Operador ${actorUser.email} não é ADMIN e não pode redefinir senhas.`,
    );
  }

  const activeSessions = await prisma.session.count({
    where: {
      userId: targetUser.id,
      revokedAt: null,
    },
  });

  if (options.dryRun) {
    console.log('DRY RUN: nenhuma alteração foi gravada.');
    console.log(`- alvo: ${targetUser.email} (${targetUser.id})`);
    console.log(`- sessões ativas a revogar: ${activeSessions}`);
    console.log(`- motivo: ${reason}`);
    if (actorUser) {
      console.log(`- operador: ${actorUser.email} (${actorUser.id})`);
    }
    if (generatedPassword) {
      console.log(`- senha temporária gerada: ${nextPassword}`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(nextPassword, 12);
  const revokedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUser.id },
      data: { passwordHash },
    });

    const revoked = await tx.session.updateMany({
      where: {
        userId: targetUser.id,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actorUser?.id ?? null,
        actorRole: actorUser
          ? actorUser.adminSubrole ?? 'ADMIN'
          : 'SYSTEM',
        action: 'auth.password_reset.assisted',
        targetType: 'USER',
        targetId: targetUser.id,
        status: 'SUCCESS',
        reason,
        route: 'ops://password-reset',
        method: 'CLI',
        metadata: {
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
          targetIsActive: targetUser.isActive,
          revokedSessions: revoked.count,
          generatedPassword,
          operatorEmail: actorUser?.email ?? null,
        },
      },
    });

    return {
      revokedSessions: revoked.count,
    };
  });

  console.log('Senha redefinida com sucesso.');
  console.log(`- utilizador: ${targetUser.email}`);
  console.log(`- sessões revogadas: ${result.revokedSessions}`);
  console.log(`- motivo: ${reason}`);

  if (actorUser) {
    console.log(`- operador: ${actorUser.email}`);
  }

  if (generatedPassword) {
    console.log('');
    console.log(
      'Senha temporária (partilha por canal seguro e pede troca imediata):',
    );
    console.log(nextPassword);
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Erro: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

