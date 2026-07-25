const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function ymd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d, days) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function main() {

  const adminPasswordHash = await bcrypt.hash("admin123", 12);
  const coachPasswordHash = await bcrypt.hash("coach123", 12);

  await prisma.user.upsert({
    where: {
      username: "admin",
    },
    update: {
      passwordHash: adminPasswordHash,
      displayName: "Clinic Admin",
      role: "ADMIN",
      isActive: true,
    },
    create: {
      username: "admin",
      passwordHash: adminPasswordHash,
      displayName: "Clinic Admin",
      role: "ADMIN",
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: {
      username: "coach",
    },
    update: {
      passwordHash: coachPasswordHash,
      displayName: "Clinic Coach",
      role: "COACH",
      isActive: true,
    },
    create: {
      username: "coach",
      passwordHash: coachPasswordHash,
      displayName: "Clinic Coach",
      role: "COACH",
      isActive: true,
    },
  });

  console.log("Seeded admin and coach users.");

  await prisma.clinicSession.deleteMany();

  const sessions = [];

  const start = new Date("2026-07-07T00:00:00");
  const end = new Date("2026-07-31T00:00:00");

  // Default capacities
  const CAP_L1 = 12;
  const CAP_L2 = 16;
  const CAP_L3 = 16;
  const CAP_L4 = 12;
  const CAP_RED = 8;

  // // Loop from July 7 → July 31
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const date = ymd(d);
    const dow = d.getDay(); // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat

    // Mon/Wed/Fri
    if (dow === 1 || dow === 3 || dow === 5) {
      sessions.push({
        date,
        startTime: "09:30",
        endTime: "11:30",
        programType: "JUNIORS",
        level: "3/4",
        capacity: CAP_L4,
        fullSessionCount: 8,
        makeUpCount: 1,
        singleDateCount: 1,
      });
    }

    // Tue/Thu
    if (dow === 2 || dow === 4) {
      sessions.push({
        date,
        startTime: "15:00",
        endTime: "16:30",
        programType: "JUNIORS",
        level: "2",
        capacity: CAP_L3,
        fullSessionCount: 9,
        makeUpCount: 1,
        singleDateCount: 1,
      });

      sessions.push({
        date,
        startTime: "16:30",
        endTime: "17:30",
        programType: "JUNIORS",
        level: "1",
        capacity: CAP_L2,
        fullSessionCount: 10,
        makeUpCount: 2,
        singleDateCount: 1,
      });
    }
  }

  await prisma.clinicSession.createMany({ data: sessions });
  console.log(`Seeded ${sessions.length} clinic sessions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
