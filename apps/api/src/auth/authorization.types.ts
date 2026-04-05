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
  | 'customer.jobs.read.own'
  | 'customer.requests.create'
  | 'customer.requests.read.own'
  | 'customer.requests.select'
  | 'customer.payments.create'
  | 'customer.payments.read.own'
  | 'customer.reviews.create'
  | 'customer.reviews.read.own'
  | 'provider.profile.manage'
  | 'provider.jobs.read.own'
  | 'provider.requests.read.open'
  | 'provider.requests.propose'
  | 'provider.jobs.status.update'
  | 'provider.earnings.read.own'
  | 'provider.reviews.read.received'
  | 'admin.ops.read'
  | 'admin.payments.read'
  | 'admin.payments.manage'
  | 'admin.categories.manage'
  | 'admin.roles.manage'
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
