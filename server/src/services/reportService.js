import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';

const STATUSES = ['SUBMITTED', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_INFORMATION', 'RESOLVED', 'CLOSED', 'REOPENED', 'REJECTED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const OPEN = ['SUBMITTED', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_INFORMATION', 'REOPENED'];

function periodRange(query) {
  const period = query.period || 'monthly';
  const today = new Date();
  const year = Number(query.year || today.getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError(400, 'Select a valid report year.');
  if (period === 'yearly') return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)), year };
  if (period === 'monthly') {
    const month = Number(query.month || today.getUTCMonth() + 1);
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new AppError(400, 'Select a valid report month.');
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)), year, month };
  }
  const chosen = query.date ? new Date(`${query.date}T00:00:00.000Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (Number.isNaN(chosen.getTime())) throw new AppError(400, 'Select a valid report date.');
  const start = new Date(chosen); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
  return { start, end, year: start.getUTCFullYear() };
}

export async function getReport(user, query = {}) {
  if (!['OFFICER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new AppError(403, 'Administrative reports are not available for this account.');
  if (user.role === 'DEPARTMENT_ADMIN' && !user.departmentId) throw new AppError(403, 'Your account is not assigned to a department.');
  if (user.role !== 'SUPER_ADMIN' && query.departmentId) throw new AppError(403, 'You cannot filter reports by another department.');

  const period = query.period || 'monthly';
  const { start, end, year, month } = periodRange({ ...query, period });
  const scope = {
    ...(user.role === 'OFFICER' ? { assignments: { some: { officerId: user.id, active: true } } } : {}),
    ...(user.role === 'DEPARTMENT_ADMIN' ? { departmentId: user.departmentId } : {}),
    ...(user.role === 'SUPER_ADMIN' && query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.priority ? { priority: query.priority } : {})
  };
  const rows = await prisma.grievance.findMany({
    where: { ...scope, createdAt: { gte: start, lt: end } },
    include: {
      category: { select: { name: true } }, department: { select: { name: true } },
      student: { select: { fullName: true, studentId: true } },
      assignments: { where: { active: true }, include: { officer: { select: { fullName: true } } }, take: 1 },
      statusHistory: { where: { toStatus: 'RESOLVED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } }
    },
    orderBy: { createdAt: 'asc' }, take: 5000
  });
  const [resolvedEvents, currentPending] = await Promise.all([
    prisma.grievanceStatusHistory.findMany({
      where: { toStatus: 'RESOLVED', createdAt: { gte: start, lt: end }, grievance: scope },
      select: { createdAt: true, grievance: { select: { createdAt: true } } }
    }),
    prisma.grievance.count({ where: { ...scope, status: { in: OPEN }, createdAt: { lt: end } } })
  ]);

  const statusCounts = new Map(STATUSES.map(status => [status, 0]));
  const categoryCounts = new Map(); const departmentCounts = new Map();
  const priorityCounts = new Map(PRIORITIES.map(priority => [priority, 0]));
  let hoursTotal = 0;
  const bucketCount = period === 'yearly' ? 12 : period === 'monthly' ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 7;
  const trend = Array.from({ length: bucketCount }, (_, index) => ({
    label: period === 'yearly' ? new Date(Date.UTC(year, index, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' }) :
      period === 'monthly' ? String(index + 1).padStart(2, '0') : new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10),
    submitted: 0, resolved: 0, pending: 0
  }));

  for (const item of rows) {
    statusCounts.set(item.status, statusCounts.get(item.status) + 1);
    categoryCounts.set(item.category.name, (categoryCounts.get(item.category.name) || 0) + 1);
    const departmentName = item.department?.name || 'Unassigned';
    departmentCounts.set(departmentName, (departmentCounts.get(departmentName) || 0) + 1);
    priorityCounts.set(item.priority, priorityCounts.get(item.priority) + 1);
    const created = new Date(item.createdAt);
    const index = period === 'yearly' ? created.getUTCMonth() : period === 'monthly' ? created.getUTCDate() - 1 : Math.floor((created - start) / 86400000);
    if (trend[index]) {
      trend[index].submitted++;
      if (OPEN.includes(item.status)) trend[index].pending++;
    }
  }
  for (const event of resolvedEvents) {
    const date = new Date(event.createdAt);
    const index = period === 'yearly' ? date.getUTCMonth() : period === 'monthly' ? date.getUTCDate() - 1 : Math.floor((date - start) / 86400000);
    if (trend[index]) trend[index].resolved++;
    hoursTotal += Math.max(0, (date - new Date(event.grievance.createdAt)) / 3600000);
  }

  const officers = await prisma.user.count({ where: { role: 'OFFICER', active: true, ...(user.role === 'DEPARTMENT_ADMIN' ? { departmentId: user.departmentId } : {}) } });
  const users = user.role === 'SUPER_ADMIN' ? await prisma.user.count({ where: { active: true } }) : undefined;
  const exports = rows.map(item => ({
    reference: item.referenceNo, student: item.student.fullName, studentId: item.student.studentId || '',
    category: item.category.name, department: item.department?.name || 'Unassigned', priority: item.priority,
    status: item.status, submittedAt: item.createdAt.toISOString(), resolvedAt: item.statusHistory[0]?.createdAt.toISOString() || '',
    assignedOfficer: item.assignments[0]?.officer?.fullName || ''
  }));
  return {
    period, year, month, start: start.toISOString(), end: end.toISOString(), total: rows.length, submitted: rows.length,
    resolved: resolvedEvents.length, pending: currentPending, open: currentPending,
    averageResolutionHours: resolvedEvents.length ? Math.round(hoursTotal / resolvedEvents.length * 10) / 10 : null,
    status: STATUSES.map(status => ({ status, count: statusCounts.get(status) })),
    category: [...categoryCounts].map(([name, count]) => ({ name, count })),
    department: [...departmentCounts].map(([name, count]) => ({ name, count })),
    priority: [...priorityCounts].map(([priority, count]) => ({ priority, count })), trend, rows: exports, officers,
    ...(users !== undefined ? { users } : {})
  };
}
