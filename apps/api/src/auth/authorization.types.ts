export type AppRole =
  | 'guest'
  | 'customer'
  | 'provider'
  | 'admin'
  | 'support_admin'
  | 'ops_admin'
  | 'super_admin';

export type Permission =
  | 'public.read'
  | 'customer.jobs.create'
  | 'customer.jobs.read.own'
  | 'customer.reviews.create'
  | 'customer.reviews.read.own'
  | 'provider.profile.manage'
  | 'provider.jobs.read.own'
  | 'provider.jobs.quote.propose'
  | 'provider.jobs.status.update'
  | 'provider.reviews.read.received'
  | 'admin.ops.read'
  | 'admin.categories.manage'
  | 'admin.users.manage'
  | 'admin.providers.manage'
  | 'admin.orders.manage'
  | 'admin.reports.read'
  | 'admin.moderation.manage'
  | 'admin.settings.manage'
  | 'admin.audit.read';

export type AccessContext = {
  userId: string | null;
  role: AppRole;
  permissions: Permission[];
  isAuthenticated: boolean;
};
