/* eslint-disable */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Seed primary user
  const faseeh = await prisma.user.upsert({
    where: { email: "covohra@gmail.com" },
    update: {},
    create: {
      email: "covohra@gmail.com",
      name: "Faseeh Vohra",
    },
  });

  // Seed default admin user (always available)
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { name: "Admin" },
    create: {
      email: "admin@example.com",
      name: "Admin",
    },
  });

  console.log("Seeded ✅", {
    faseeh: faseeh.email,
    admin: admin.email,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
