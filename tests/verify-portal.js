// Automated Acceptance Verification Test Suite for ExamPortal
// Tests: Scoring algorithms, Paper generation, Link tokens, and Proctoring event logging

const assert = require("assert");

console.log("==================================================");
console.log("   EXAMPORTAL ACCEPTANCE & VERIFICATION TEST SUITE");
console.log("==================================================\n");

// 1. Scoring Logic Verification (+4, -1, 0)
console.log("Test 1: Server-Side Scoring Algorithm");
function calculateScore(questions, responses, marksPerQ = 4, negMarks = 1) {
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalUnanswered = 0;
  let score = 0;

  const responseMap = new Map();
  responses.forEach((r) => responseMap.set(r.question_id, r.selected_option));

  questions.forEach((q) => {
    const selected = responseMap.get(q.id);
    if (!selected) {
      totalUnanswered += 1;
      // 0 marks for unanswered
    } else if (selected.toUpperCase() === q.correct_option.toUpperCase()) {
      totalCorrect += 1;
      score += marksPerQ;
    } else {
      totalIncorrect += 1;
      score -= negMarks;
    }
  });

  return { score, totalCorrect, totalIncorrect, totalUnanswered };
}

const mockQuestions = [
  { id: "q1", correct_option: "A" },
  { id: "q2", correct_option: "B" },
  { id: "q3", correct_option: "C" },
  { id: "q4", correct_option: "D" },
  { id: "q5", correct_option: "A" },
];

// Case A: 3 correct, 1 wrong, 1 unanswered
// Expected: 3*(+4) - 1*(1) + 0 = 12 - 1 = 11
const resA = calculateScore(mockQuestions, [
  { question_id: "q1", selected_option: "A" }, // +4
  { question_id: "q2", selected_option: "B" }, // +4
  { question_id: "q3", selected_option: "C" }, // +4
  { question_id: "q4", selected_option: "A" }, // -1 (wrong)
  { question_id: "q5", selected_option: null }, // 0 (unanswered)
]);

assert.strictEqual(resA.totalCorrect, 3);
assert.strictEqual(resA.totalIncorrect, 1);
assert.strictEqual(resA.totalUnanswered, 1);
assert.strictEqual(resA.score, 11);
console.log("  ✓ Case A: 3 correct, 1 incorrect, 1 unanswered = 11 marks (+4/-1/0) passed.");

// Case B: All wrong
const resB = calculateScore(mockQuestions, [
  { question_id: "q1", selected_option: "D" },
  { question_id: "q2", selected_option: "A" },
  { question_id: "q3", selected_option: "A" },
  { question_id: "q4", selected_option: "A" },
  { question_id: "q5", selected_option: "D" },
]);
assert.strictEqual(resB.score, -5);
console.log("  ✓ Case B: 5 incorrect = -5 marks passed.");

// Case C: All unanswered
const resC = calculateScore(mockQuestions, []);
assert.strictEqual(resC.score, 0);
assert.strictEqual(resC.totalUnanswered, 5);
console.log("  ✓ Case C: 5 unanswered = 0 marks passed.");

// 2. Randomized Batch Paper Generator Verification (No duplicate questions within paper)
console.log("\nTest 2: Randomized Batch Paper Generation & No Duplicate Questions");
function generatePaperBatches(questionPool, totalQuestionsPerPaper, batchCount = 3) {
  assert(questionPool.length >= totalQuestionsPerPaper, "Pool must have enough questions");
  const batches = [];

  for (let b = 1; b <= batchCount; b++) {
    // Fisher-Yates shuffle
    const shuffled = [...questionPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selectedQuestions = shuffled.slice(0, totalQuestionsPerPaper);

    // Verify uniqueness within paper
    const uniqueIds = new Set(selectedQuestions.map((q) => q.id));
    assert.strictEqual(uniqueIds.size, totalQuestionsPerPaper, "Must have zero duplicates in single paper");

    batches.push({
      batch_number: b,
      questions: selectedQuestions.map((q, idx) => ({ ...q, question_order: idx + 1 })),
    });
  }

  return batches;
}

const largePool = Array.from({ length: 50 }, (_, i) => ({ id: `q_${i}`, text: `Question ${i}` }));
const batches = generatePaperBatches(largePool, 10, 4);

assert.strictEqual(batches.length, 4);
batches.forEach((b) => {
  assert.strictEqual(b.questions.length, 10);
  const ids = new Set(b.questions.map((q) => q.id));
  assert.strictEqual(ids.size, 10);
});
console.log(`  ✓ Successfully generated 4 distinct randomized batches with 10 unique questions each.`);

// 3. Security Check: Student endpoints must strip `correct_option`
console.log("\nTest 3: Security Sanitization (Strip Answer Keys on Student Payloads)");
function sanitizeQuestionsForCandidate(batchQuestions) {
  return batchQuestions.map(({ id, question_text, option_a, option_b, option_c, option_d, question_order }) => ({
    id,
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    question_order,
  }));
}

const rawQuestions = [
  {
    id: "q_secure_1",
    question_text: "What is 2 + 2?",
    option_a: "3",
    option_b: "4",
    option_c: "5",
    option_d: "6",
    correct_option: "B",
    created_by: "admin",
  },
];

const candidatePayload = sanitizeQuestionsForCandidate(rawQuestions);
assert.strictEqual(candidatePayload[0].correct_option, undefined, "Student must never receive correct_option");
assert.strictEqual("correct_option" in candidatePayload[0], false);
console.log("  ✓ Student-facing payload strictly strips correct_option answer key.");

// 4. Edge AI Proctoring Event Schema and Summary Aggregation
console.log("\nTest 4: Edge AI Proctoring Event Logging & Categorical Summaries");
const sampleLogs = [
  { event_type: "tab_hidden", timestamp: "2026-10-12T10:00:00Z" },
  { event_type: "tab_visible", timestamp: "2026-10-12T10:00:03Z" },
  { event_type: "fullscreen_exit", timestamp: "2026-10-12T10:05:00Z" },
  { event_type: "multiple_faces_detected", timestamp: "2026-10-12T10:07:00Z", details: { faceCount: 2 } },
  { event_type: "head_turned_away", timestamp: "2026-10-12T10:12:00Z", details: { yawDeg: 34 } },
  { event_type: "face_not_detected", timestamp: "2026-10-12T10:15:00Z" },
  { event_type: "looking_down", timestamp: "2026-10-12T10:20:00Z", details: { pitchDeg: 28 } },
];

function summarizeProctorLogs(logs) {
  const warningTypes = [
    "tab_hidden",
    "fullscreen_exit",
    "face_not_detected",
    "multiple_faces_detected",
    "head_turned_away",
    "looking_down",
    "gaze_away",
    "background_person_detected",
  ];

  const warnings = logs.filter((l) => warningTypes.includes(l.event_type));

  return {
    totalEvents: logs.length,
    warningsCount: warnings.length,
    tabSwitches: logs.filter((l) => l.event_type === "tab_hidden").length,
    fullscreenExits: logs.filter((l) => l.event_type === "fullscreen_exit").length,
    multipleFaces: logs.filter((l) => ["multiple_faces_detected", "background_person_detected"].includes(l.event_type)).length,
    faceLosses: logs.filter((l) => l.event_type === "face_not_detected").length,
    headTurns: logs.filter((l) => l.event_type === "head_turned_away").length,
    lookingDown: logs.filter((l) => l.event_type === "looking_down").length,
  };
}

const summary = summarizeProctorLogs(sampleLogs);
assert.strictEqual(summary.totalEvents, 7);
assert.strictEqual(summary.warningsCount, 6);
assert.strictEqual(summary.tabSwitches, 1);
assert.strictEqual(summary.fullscreenExits, 1);
assert.strictEqual(summary.multipleFaces, 1);
assert.strictEqual(summary.headTurns, 1);
assert.strictEqual(summary.faceLosses, 1);
assert.strictEqual(summary.lookingDown, 1);

console.log("  ✓ Proctor event aggregation matches expected classifications.");

console.log("\n==================================================");
console.log("   ALL 4 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ✓");
console.log("==================================================");
