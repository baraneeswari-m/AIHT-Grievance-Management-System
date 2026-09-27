import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const departments = ['CSE', 'IT', 'CSBS', 'EEE', 'ECE', 'AGRI', 'MBA', 'AIDS'];
const legacySeedDepartments = ['Academic', 'Examination', 'Administration', 'Hostel', 'Infrastructure', 'Library', 'Transport', 'Security', 'Student Affairs'];
const categories = ['Academic', 'Examination', 'Fees', 'Hostel', 'Infrastructure', 'Library', 'Transport', 'IT / Technical', 'Cleanliness', 'Security', 'Other'];

async function main() {
  const departmentIds = {};
  for (const name of departments) {
    const department = await prisma.department.upsert({ where: { name }, update: { active: true }, create: { name } });
    departmentIds[name] = department.id;
  }
  // Keep old department records and all their references; stop offering only the former seed list for new routing.
  await prisma.department.updateMany({ where: { name: { in: legacySeedDepartments } }, data: { active: false } });
  for (const name of categories) await prisma.grievanceCategory.upsert({ where: { name }, update: {}, create: { name } });

  const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      await prisma.user.create({ data: {
        email: adminEmail,
        fullName: process.env.SEED_SUPER_ADMIN_NAME?.trim() || 'CGMS Super Admin',
        role: 'SUPER_ADMIN',
        active: true,
        passwordHash: await bcrypt.hash(adminPassword, 12)
      } });
    }
  }
  console.log('Seed complete. Existing records were retained.');
}

main().catch(error => { console.error('Seed failed safely.', { code: error.code || 'SEED_ERROR' }); process.exitCode = 1; }).finally(() => prisma.$disconnect());
