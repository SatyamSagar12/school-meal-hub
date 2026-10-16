-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "udiseCode" TEXT,
    "district" TEXT,
    "state" TEXT,
    "academicYear" TEXT NOT NULL,
    "ricePerStudentG" REAL NOT NULL DEFAULT 100,
    "dalPerStudentG" REAL NOT NULL DEFAULT 20,
    "vegPerStudentG" REAL NOT NULL DEFAULT 50,
    "budgetPerStudent" REAL NOT NULL DEFAULT 6.78,
    "masalaPerStudent" REAL NOT NULL DEFAULT 1.2,
    "fuelPerStudent" REAL NOT NULL DEFAULT 1,
    "ricePerStudentGUpper" REAL NOT NULL DEFAULT 150,
    "dalPerStudentGUpper" REAL NOT NULL DEFAULT 30,
    "vegPerStudentGUpper" REAL NOT NULL DEFAULT 75,
    "budgetPerStudentUpper" REAL NOT NULL DEFAULT 10.17,
    "masalaPerStudentUpper" REAL NOT NULL DEFAULT 1.8,
    "fuelPerStudentUpper" REAL NOT NULL DEFAULT 1.5,
    "plan" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" DATETIME,
    "paidUntil" DATETIME,
    "billingExempt" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" DATETIME,
    "suspendReason" TEXT,
    "termsVersion" TEXT,
    "termsAcceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEACHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "rollNo" TEXT,
    "name" TEXT NOT NULL,
    "fatherName" TEXT,
    "motherName" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'MALE',
    "dob" TEXT,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'A',
    "mobile" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "markedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class_attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "presentCount" INTEGER NOT NULL,
    "enrolledCount" INTEGER NOT NULL,
    "markedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "class_attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "budgetPerStudent" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "class_rates_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "presentPrimary" INTEGER NOT NULL DEFAULT 0,
    "presentUpper" INTEGER NOT NULL DEFAULT 0,
    "riceKg" REAL NOT NULL DEFAULT 0,
    "dalKg" REAL NOT NULL DEFAULT 0,
    "vegKg" REAL NOT NULL DEFAULT 0,
    "riceKgUpper" REAL NOT NULL DEFAULT 0,
    "dalKgUpper" REAL NOT NULL DEFAULT 0,
    "vegKgUpper" REAL NOT NULL DEFAULT 0,
    "dalRate" REAL NOT NULL DEFAULT 0,
    "vegRate" REAL NOT NULL DEFAULT 0,
    "dalCost" REAL NOT NULL DEFAULT 0,
    "vegCost" REAL NOT NULL DEFAULT 0,
    "masalaCost" REAL NOT NULL DEFAULT 0,
    "fuelCost" REAL NOT NULL DEFAULT 0,
    "miscCost" REAL NOT NULL DEFAULT 0,
    "miscNote" TEXT,
    "totalExpense" REAL NOT NULL DEFAULT 0,
    "budget" REAL NOT NULL DEFAULT 0,
    "creditsSaved" REAL NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "daily_expenses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "schoolName" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "months" INTEGER NOT NULL DEFAULT 12,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "merchantOrderId" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerRef" TEXT,
    "createdById" TEXT,
    "paidAt" DATETIME,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "resetAtMs" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_schoolId_idx" ON "users"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "students_schoolId_status_className_section_idx" ON "students"("schoolId", "status", "className", "section");

-- CreateIndex
CREATE UNIQUE INDEX "students_schoolId_admissionNo_key" ON "students"("schoolId", "admissionNo");

-- CreateIndex
CREATE INDEX "attendance_schoolId_date_idx" ON "attendance"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_studentId_date_key" ON "attendance"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "class_attendance_schoolId_date_className_section_key" ON "class_attendance"("schoolId", "date", "className", "section");

-- CreateIndex
CREATE UNIQUE INDEX "class_rates_schoolId_className_section_key" ON "class_rates"("schoolId", "className", "section");

-- CreateIndex
CREATE UNIQUE INDEX "daily_expenses_schoolId_date_key" ON "daily_expenses"("schoolId", "date");

-- CreateIndex
CREATE INDEX "audit_logs_schoolId_createdAt_idx" ON "audit_logs"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchantOrderId_key" ON "payments"("merchantOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerOrderId_key" ON "payments"("providerOrderId");

-- CreateIndex
CREATE INDEX "payments_schoolId_idx" ON "payments"("schoolId");

-- CreateIndex
CREATE INDEX "payments_status_provider_idx" ON "payments"("status", "provider");

