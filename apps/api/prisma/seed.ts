import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant' },
    update: {},
    create: { id: 'demo-tenant', name: 'Demo Workspace' },
  });

  const passwordHash = await bcrypt.hash('demo1234', 10);
  await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
      name: 'Demo Admin',
      role: 'OWNER',
      tenantId: tenant.id,
    },
  });

  await prisma.rule.upsert({
    where: { id: 'demo-rule-pricing' },
    update: {},
    create: {
      id: 'demo-rule-pricing',
      tenantId: tenant.id,
      name: 'Pricing question',
      keywords: ['price', 'pricing', 'cost', 'سعر', 'بكام'],
      matchType: 'CONTAINS',
      channel: 'BOTH',
      responseTemplate:
        'Hi {{first_name}}! Thanks for reaching out — please check our pricing page or DM us for a tailored quote.',
      priority: 10,
    },
  });

  await prisma.rule.upsert({
    where: { id: 'demo-rule-greeting' },
    update: {},
    create: {
      id: 'demo-rule-greeting',
      tenantId: tenant.id,
      name: 'Greeting',
      keywords: ['hi', 'hello', 'hey', 'سلام', 'اهلا'],
      matchType: 'CONTAINS',
      channel: 'BOTH',
      responseTemplate: 'Hello {{first_name}}! 👋 How can we help you today?',
      priority: 5,
    },
  });

  await prisma.aiConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      enabled: false,
      systemPrompt:
        'You are a friendly customer-support assistant for our Facebook page. Reply concisely (max 2 sentences) in the same language as the customer.',
    },
  });

  console.log('Seed complete. Login: demo@example.com / demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
