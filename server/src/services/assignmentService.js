import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { audit, notify } from './audit.js';
import { sendNotice } from './mail.js';

export async function assignGrievance({ grievanceId, input, actor }) {
  const grievance = await prisma.grievance.findUnique({
    where: { id: grievanceId },
    include: { student: { select: { id: true, fullName: true, studentId: true, email: true } }, category: true, department: true }
  });
  if (!grievance) throw new AppError(404, 'Grievance not found.');

  if (actor.role === 'DEPARTMENT_ADMIN') {
    if (input.departmentAdminId) throw new AppError(403, 'Only a Super Admin can assign a Department Admin.');
    if ((grievance.departmentId && grievance.departmentId !== actor.departmentId) || (input.departmentId && input.departmentId !== actor.departmentId)) {
      throw new AppError(403, 'This grievance is outside your department.');
    }
  }

  const departmentId = input.departmentId || grievance.departmentId || (actor.role === 'DEPARTMENT_ADMIN' ? actor.departmentId : null);
  const needsDepartment = Boolean(input.departmentAdminId || input.officerId);
  if (needsDepartment && !departmentId) throw new AppError(400, 'Select a department before assigning an administrator or officer.');

  const department = departmentId ? await prisma.department.findUnique({ where: { id: departmentId } }) : null;
  if (departmentId && (!department || !department.active)) throw new AppError(400, 'Select an active department.');

  const [departmentAdmin, officer] = await Promise.all([
    input.departmentAdminId ? prisma.user.findUnique({ where: { id: input.departmentAdminId }, select: { id: true, role: true, active: true, departmentId: true, fullName: true, email: true } }) : null,
    input.officerId ? prisma.user.findUnique({ where: { id: input.officerId }, select: { id: true, role: true, active: true, departmentId: true, fullName: true, email: true } }) : null
  ]);
  if (input.departmentAdminId && (!departmentAdmin || departmentAdmin.role !== 'DEPARTMENT_ADMIN' || !departmentAdmin.active || departmentAdmin.departmentId !== departmentId)) {
    throw new AppError(400, 'Select an active Department Admin assigned to the selected department.');
  }
  if (input.officerId && (!officer || officer.role !== 'OFFICER' || !officer.active || officer.departmentId !== departmentId)) {
    throw new AppError(400, 'Select an active Officer assigned to the selected department.');
  }

  const assignedNames = [departmentAdmin && `Department Admin: ${departmentAdmin.fullName}`, officer && `Officer: ${officer.fullName}`].filter(Boolean);
  const note = `${department ? `Department: ${department.name}` : 'Department unchanged'}${assignedNames.length ? `; ${assignedNames.join('; ')}` : ''}`;
  const updated = await prisma.$transaction(async tx => {
    await tx.grievanceAssignment.updateMany({ where: { grievanceId: grievance.id, active: true }, data: { active: false } });
    await tx.grievanceAssignment.create({ data: { grievanceId: grievance.id, officerId: officer?.id || null, departmentAdminId: departmentAdmin?.id || null, assignedById: actor.id } });
    const nextStatus = ['SUBMITTED', 'ACKNOWLEDGED'].includes(grievance.status) ? 'ASSIGNED' : grievance.status;
    return tx.grievance.update({
      where: { id: grievance.id },
      data: {
        departmentId: departmentId || null,
        status: nextStatus,
        statusHistory: { create: { fromStatus: grievance.status, toStatus: nextStatus, note: `Assignment updated. ${note}`, changedById: actor.id } }
      },
      include: { department: true }
    });
  });

  const departmentAdmins = officer ? await prisma.user.findMany({
    where: { role: 'DEPARTMENT_ADMIN', departmentId, active: true },
    select: { id: true, email: true, fullName: true }
  }) : [];
  const directRecipients = new Map();
  if (departmentAdmin) directRecipients.set(departmentAdmin.id, { ...departmentAdmin, assignmentRole: 'Department Admin' });
  if (officer) directRecipients.set(officer.id, { ...officer, assignmentRole: 'Officer' });

  const noticeRecipients = new Map(directRecipients);
  for (const admin of departmentAdmins) if (!noticeRecipients.has(admin.id) && admin.id !== actor.id) {
    noticeRecipients.set(admin.id, { ...admin, responsibleAdminNotice: true });
  }
  await Promise.all([...noticeRecipients.values()].map(user => notify(
    user.id,
    grievance.id,
    user.responsibleAdminNotice
      ? `Officer ${officer.fullName} was assigned to grievance ${grievance.referenceNo} in your department.`
      : `You have been assigned grievance ${grievance.referenceNo}.`
  )));
  await notify(grievance.student.id, grievance.id, `Grievance ${grievance.referenceNo} assignment was updated.`);

  const emailGrievance = { ...grievance, department: department || grievance.department, status: updated.status };
  const emails = [];
  if (departmentAdmin) emails.push(sendNotice({ to: departmentAdmin.email, subject: `Grievance assigned - ${grievance.referenceNo}`, heading: 'You have been assigned a grievance', introduction: 'A grievance has been assigned to you as Department Admin.', grievance: emailGrievance, event: 'GRIEVANCE_ASSIGNED_DEPARTMENT_ADMIN', additionalFields: [['Assigned role', 'Department Admin'], ...(officer ? [['Officer', officer.fullName]] : [])] }));
  if (officer) emails.push(sendNotice({ to: officer.email, subject: `You have been assigned a grievance - ${grievance.referenceNo}`, heading: 'You have been assigned a grievance', introduction: 'A grievance has been assigned to you as Officer.', grievance: emailGrievance, event: 'GRIEVANCE_ASSIGNED_OFFICER', additionalFields: [['Assigned role', 'Officer']] }));
  for (const admin of departmentAdmins) if (!directRecipients.has(admin.id) && admin.id !== actor.id) {
    emails.push(sendNotice({ to: admin.email, subject: `Officer assigned to grievance - ${grievance.referenceNo}`, heading: 'An officer has been assigned to a grievance in your department', introduction: `Officer ${officer.fullName} has been assigned to this grievance.`, grievance: emailGrievance, event: 'OFFICER_ASSIGNED_DEPARTMENT_NOTICE', additionalFields: [['Officer', officer.fullName]] }));
  }
  await Promise.all(emails);

  if (departmentId && departmentId !== grievance.departmentId) await audit(actor.id, 'GRIEVANCE_DEPARTMENT_ASSIGNED', `${grievance.referenceNo}: department set to ${department.name}`, 'Grievance', grievance.id);
  if (departmentAdmin) await audit(actor.id, 'GRIEVANCE_DEPARTMENT_ADMIN_ASSIGNED', `${grievance.referenceNo}: assigned to Department Admin ${departmentAdmin.fullName}`, 'Grievance', grievance.id);
  if (officer) await audit(actor.id, 'GRIEVANCE_OFFICER_ASSIGNED', `${grievance.referenceNo}: assigned to Officer ${officer.fullName}`, 'Grievance', grievance.id);
  return updated;
}
