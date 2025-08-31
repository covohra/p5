require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const user = await prisma.user.upsert({
    where:  { email: "covohra@gmail.com" },
    update: {},
    create: { email: "covohra@gmail.com", name: "Faseeh Vohra" }
  });
  console.log("Seeded:", user.email);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
