import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/feedback_forge";

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl)
});

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "founder@orbit.chat" },
    update: {},
    create: {
      email: "founder@orbit.chat",
      name: "Klaudia",
      role: "ADMIN",
      plan: "EARLY_ADOPTER",
      lifetimeFree: true,
      stripeCustomerId: "cus_early_001"
    }
  });

  const member = await prisma.user.upsert({
    where: { email: "mila@example.com" },
    update: {},
    create: {
      email: "mila@example.com",
      name: "Mila",
      discordId: "71820491"
    }
  });

  const project = await prisma.project.upsert({
    where: { slug: "orbit-chat" },
    update: {},
    create: {
      name: "Orbit Chat",
      slug: "orbit-chat",
      description: "Lekka społeczność dla zamkniętych grup, modderów i twórców.",
      ownerId: owner.id
    }
  });

  const feedback = await prisma.feedback.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      projectId: project.id,
      authorId: member.id,
      title: "Kanały tylko dla patronów z automatyczną rolą",
      description:
        "Po opłaceniu dostępu użytkownik powinien dostać rolę i widzieć paczki dodatków bez ręcznej moderacji.",
      status: "PLANNED",
      category: "FEATURE",
      source: "DISCORD",
      tags: ["monetyzacja", "role"],
      priority: 4,
      upvotesCount: 1
    }
  });

  await prisma.vote.upsert({
    where: {
      userId_feedbackId: {
        userId: member.id,
        feedbackId: feedback.id
      }
    },
    update: {},
    create: {
      userId: member.id,
      feedbackId: feedback.id
    }
  });

  console.log(`Seeded project ${project.slug}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

