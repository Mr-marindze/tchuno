# Backup And Restore Runbook

This runbook defines the minimum PostgreSQL backup and restore process for a
controlled pilot. It is not a production disaster recovery plan.

## Storage Location

Backups are written under:

```text
backups/postgres/
```

The `backups/` directory is ignored by Git.

Backup filenames include only a timestamp and do not include usernames,
passwords, hostnames, or database URLs.

## Create Backup

Requirements:

- `DATABASE_URL` points to the source database;
- `pg_dump` is available in `PATH`.

Command:

```bash
DATABASE_URL="postgresql://..." corepack yarn ops:backup:postgres
```

Optional output directory:

```bash
BACKUP_DIR=/secure/local/path DATABASE_URL="postgresql://..." corepack yarn ops:backup:postgres
```

The script fails if `DATABASE_URL` is missing, `pg_dump` is missing, or the
generated backup file already exists.

## Restore Backup

Requirements:

- restore target is isolated and intentionally selected;
- `pg_restore` is available in `PATH`;
- operator sets `RESTORE_CONFIRM=restore`.

Command:

```bash
RESTORE_DATABASE_URL="postgresql://..." RESTORE_CONFIRM=restore corepack yarn ops:restore:postgres -- backups/postgres/tchuno-postgres-YYYYMMDDTHHMMSSZ.dump
```

The restore uses `pg_restore --clean --if-exists --no-owner --no-privileges`.
Do not restore over a human development or pilot database without approval.

## Restore Test

For pilot gate validation:

1. Create an isolated test database.
2. Run migrations.
3. Create representative records:
   - `User`;
   - `ServiceRequest`;
   - `Proposal`;
   - `Job`.
4. Run backup.
5. Create a clean restore database.
6. Restore the backup.
7. Verify counts or selected ids for the representative records.
8. Drop isolated test databases after evidence is captured when appropriate.

## Limitations

- This is manual backup/restore, not automated production backup.
- Retention, encryption at rest, offsite replication, and restore-time
  objectives require a future production decision.
