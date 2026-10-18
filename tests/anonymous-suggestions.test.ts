import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/db";
import { setupDb, resetDb } from "./helpers";
import { generateReceiptCode, generateSecretToken, hashSecretToken, verifySecretToken } from "@/lib/crypto";

describe("Truly Anonymous Student Suggestion Subsystem (Security & Privacy)", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("generates a random, non-identifying public receipt code", () => {
    const code = generateReceiptCode();
    expect(code).toMatch(/^NPS-[2-9A-Z]{8}$/);
  });

  it("generates a high-entropy secret token", () => {
    const token = generateSecretToken();
    expect(token).toMatch(/^sec_[a-f0-9]{64}$/);
  });

  it("correctly hashes and verifies secret tokens with timing-safe comparison", () => {
    const token = generateSecretToken();
    const hash = hashSecretToken(token);
    expect(verifySecretToken(token, hash)).toBe(true);
    expect(verifySecretToken("sec_wrong_token", hash)).toBe(false);
    expect(verifySecretToken("", hash)).toBe(false);
  });

  it("submits a suggestion anonymously without requiring user credentials", async () => {
    const result = await db.submitAnonymousSuggestion(
      "facilities",
      "Kutubxona stollariga yoritish chiroqlari qo'yish",
      "Kechki payt dars tayyorlash uchun stollarga qo'shimcha yoritish chiroqlari kerak."
    );

    expect(result).toHaveProperty("receiptCode");
    expect(result).toHaveProperty("secretToken");
    expect(result.receiptCode).toMatch(/^NPS-/);
    expect(result.secretToken).toMatch(/^sec_/);

    // CRITICAL PRIVACY ASSERTION: No user ID, no IP address returned
    expect((result as any).userId).toBeUndefined();
    expect((result as any).studentId).toBeUndefined();
    expect((result as any).ipAddress).toBeUndefined();
  });

  it("allows the submitter to retrieve status and response using valid receipt credentials", async () => {
    const submission = await db.submitAnonymousSuggestion(
      "catering",
      "Oshxona menyusiga mevalar qo'shish",
      "Tushlikdan so'ng yangi mavsumiy mevalar berilsa yaxshi bo'lardi."
    );

    const record = await db.getAnonymousSuggestionByReceipt(
      submission.receiptCode,
      submission.secretToken
    );

    expect(record).not.toBeNull();
    expect(record?.title).toBe("Oshxona menyusiga mevalar qo'shish");
    expect(record?.status).toBe("received");

    // CRITICAL PRIVACY PROPERTY: Database record contains ZERO identity fields
    expect((record as any).secretHash).toBeUndefined(); // Never returned to client
    expect((record as any).userId).toBeUndefined();
    expect((record as any).authorId).toBeUndefined();
    expect((record as any).studentId).toBeUndefined();
  });

  it("denies access when an incorrect secret token is supplied", async () => {
    const submission = await db.submitAnonymousSuggestion(
      "academic",
      "Fizika laboratoriyasida amaliy mashg'ulotlarni ko'paytirish",
      "Nazariy darslar o'rniga amaliy tajribalar ko'proq o'tkazilsa."
    );

    const record = await db.getAnonymousSuggestionByReceipt(
      submission.receiptCode,
      "sec_invalid_attacker_guess"
    );

    expect(record).toBeNull();
  });

  it("lists all suggestions for reviewers without seeing author identity", async () => {
    const directorList = await db.getAllAnonymousSuggestions();
    expect(directorList.length).toBeGreaterThanOrEqual(2);

    for (const item of directorList) {
      expect((item as any).userId).toBeUndefined();
      expect((item as any).studentId).toBeUndefined();
      expect((item as any).authorIp).toBeUndefined();
      expect((item as any).secretHash).toBeUndefined();
    }

  });

  it("updates status and publish official response", async () => {
    const submission = await db.submitAnonymousSuggestion(
      "general",
      "Kutubxona vaqtini 19:00 gacha uzaytirish",
      "O'quvchilar darsdan keyin ko'proq kitob o'qishlari uchun vaqt uzaytirilsa."
    );

    const all = await db.getAllAnonymousSuggestions();
    const target = all.find((s) => s.receiptCode === submission.receiptCode);
    expect(target).toBeDefined();

    await db.updateAnonymousSuggestionStatus(
      target!.id,
      "approved",
      "Taklif ma'qullandi! Dushanbadan kutubxona 19:00 gacha ishlaydi."
    );

    // Submitter checks status with their private token
    const updated = await db.getAnonymousSuggestionByReceipt(
      submission.receiptCode,
      submission.secretToken
    );

    expect(updated?.status).toBe("approved");
    expect(updated?.officialResponse).toBe(
      "Taklif ma'qullandi! Dushanbadan kutubxona 19:00 gacha ishlaydi."
    );
  });
});
