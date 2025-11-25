-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanMember" (
    "userId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',

    PRIMARY KEY ("userId", "planId"),
    CONSTRAINT "PlanMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanMember_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanMember" ("planId", "role", "userId") SELECT "planId", "role", "userId" FROM "PlanMember";
DROP TABLE "PlanMember";
ALTER TABLE "new_PlanMember" RENAME TO "PlanMember";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
