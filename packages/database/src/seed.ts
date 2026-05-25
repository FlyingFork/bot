import "dotenv/config";
import { prisma } from "./index";

async function main() {
  await prisma.allianceSettings.upsert({
    where: { id: "primary" },
    update: {},
    create: { id: "primary" },
  });
  console.log("Seeded AllianceSettings");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
