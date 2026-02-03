const { PrismaClient } = require("@prisma/client");

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
  await prisma.clinicSession.deleteMany();

  const sessions = [];
  const today = new Date();

  // Default capacities (adjust later)
  const CAP_L1 = 12;
  const CAP_L2 = 16;
  const CAP_L3 = 16;
  const CAP_L4 = 12;
  const CAP_RED = 8;

  // Seed next 14 days based on your schedule
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    const date = ymd(d);
    const dow = d.getDay(); // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat

    // Mon/Wed: Level 4 (4-6) and Level 1 (6-7)
    if (dow === 1 || dow === 3) {
      sessions.push({
        date,
        startTime: "16:00",
        endTime: "18:00",
        programType: "JUNIORS",
        level: 4,
        capacity: CAP_L4,
        fullSessionCount: 8,
        makeUpCount: 1,
        singleDateCount: 1,
      });

      sessions.push({
        date,
        startTime: "18:00",
        endTime: "19:00",
        programType: "JUNIORS",
        level: 1,
        capacity: CAP_L1,
        fullSessionCount: 7,
        makeUpCount: 1,
        singleDateCount: 2,
      });
    }

    // Tue/Thu: Level 3 (4-5:30) and Level 2 (5:30-7)
    if (dow === 2 || dow === 4) {
      sessions.push({
        date,
        startTime: "16:00",
        endTime: "17:30",
        programType: "JUNIORS",
        level: 3,
        capacity: CAP_L3,
        fullSessionCount: 9,
        makeUpCount: 1,
        singleDateCount: 1,
      });

      sessions.push({
        date,
        startTime: "17:30",
        endTime: "19:00",
        programType: "JUNIORS",
        level: 2,
        capacity: CAP_L2,
        fullSessionCount: 10,
        makeUpCount: 2,
        singleDateCount: 1,
      });
    }

    // Saturday: Red Ball (example time)
    if (dow === 6) {
        // Saturday
      
        // Red Ball
        sessions.push({
          date,
          startTime: "11:00",
          endTime: "11:45",
          programType: "RED_BALL",
          level: null,
          capacity: CAP_RED,
          fullSessionCount: 6,
          makeUpCount: 0,
          singleDateCount: 1,
        });
      
        // Level 1 (12-1)
        sessions.push({
          date,
          startTime: "12:00",
          endTime: "13:00",
          programType: "JUNIORS",
          level: 1,
          capacity: CAP_L1,
          fullSessionCount: 7,
          makeUpCount: 1,
          singleDateCount: 1,
        });
      
        // Level 2 (1-2:30)
        sessions.push({
          date,
          startTime: "13:00",
          endTime: "14:30",
          programType: "JUNIORS",
          level: 2,
          capacity: CAP_L2,
          fullSessionCount: 10,
          makeUpCount: 1,
          singleDateCount: 1,
        });
      
        // Level 3 (2:30-4)
        sessions.push({
          date,
          startTime: "14:30",
          endTime: "16:00",
          programType: "JUNIORS",
          level: 3,
          capacity: CAP_L3,
          fullSessionCount: 9,
          makeUpCount: 1,
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
