const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@ai-dev.local").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin12345!";

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: "ADMIN",
      isEmailVerified: true,
      wallet: {
        create: {
          availableBalance: 0,
          frozenBalance: 0,
          currency: "CNY"
        }
      }
    },
    update: {
      passwordHash,
      role: "ADMIN",
      isEmailVerified: true
    }
  });

  const wallet = await prisma.wallet.findFirst({
    where: {
      userId: user.id,
      deletedAt: null
    }
  });
  if (!wallet) {
    await prisma.wallet.create({
      data: {
        userId: user.id,
        availableBalance: 0,
        frozenBalance: 0,
        currency: "CNY"
      }
    });
  }

  console.log("ADMIN_BOOTSTRAP_SUCCESS");
  console.log(`email=${email}`);
  console.log("password=<from ADMIN_PASSWORD env or default>");
  console.log(`userId=${user.id}`);
}

main()
  .catch((error) => {
    console.error("ADMIN_BOOTSTRAP_FAILED", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
