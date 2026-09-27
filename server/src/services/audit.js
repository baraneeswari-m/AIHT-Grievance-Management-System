import { prisma } from '../config/db.js';
export async function audit(userId,action,description,entityType=null,entityId=null){
  try { return await prisma.auditLog.create({data:{userId,action,description,entityType,entityId}}); }
  catch (error) { console.error('[audit] Audit record could not be saved.', { action, code: error.code || 'AUDIT_ERROR' }); }
}
export async function notify(userId,grievanceId,message){
  if (!userId) return;
  try {
    const active = await prisma.user.findFirst({ where: { id: userId, active: true }, select: { id: true } });
    if (!active) return;
    return await prisma.notification.create({data:{userId,grievanceId,message}});
  }
  catch (error) { console.error('[notification] In-app notification could not be saved.', { code: error.code || 'NOTIFICATION_ERROR' }); }
}
