/**
 * Comprehensive Verification of Proctor Event Persistence & Dashboard Aggregation
 */

const BASE_URL = "http://localhost:3006";
const TOKEN = "0dce5c334ca046feaae357318669658f";

async function runVerification() {
  console.log("===============================================================");
  console.log("  PROCTORING EVENT PIPELINE & DASHBOARD AUDIT VERIFICATION  ");
  console.log("===============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Candidate Authentication
  console.log("Test Group 1: Candidate Authentication & Session Cookie");
  const loginRes = await fetch(`${BASE_URL}/api/auth/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      email: "candidate1@examportal.com",
      password: "CandidatePassword@123",
    }),
  });
  const loginData = await loginRes.json();
  const setCookieHeader = loginRes.headers.get("set-cookie") || "";
  const cookieMatch = setCookieHeader.match(/candidate_session=[^;]+/);
  const candidateCookie = cookieMatch ? cookieMatch[0] : "";

  assert(loginRes.status === 200, `Candidate logged in with status 200`);
  assert(!!candidateCookie, `Valid candidate_session cookie acquired`);

  // 2. Admin Authentication
  console.log("\nTest Group 2: Administrator Authentication on Supabase");
  const { createClient } = require("@supabase/supabase-js");
  require("dotenv").config({ path: ".env.local" });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data: adminAuth, error: adminAuthErr } = await supabase.auth.signInWithPassword({
    email: "admin@examportal.com",
    password: "AdminPassword@123",
  });
  assert(!adminAuthErr && !!adminAuth.session, "Admin session authenticated successfully");
  const adminToken = adminAuth.session?.access_token;

  // 3. Fetch Exam ID by Token
  // Query Supabase for the active published exam token
  const { data: publishedExams } = await supabase
    .from("exams")
    .select("id, exam_link_token, title, status")
    .eq("status", "published")
    .limit(1);

  const activeToken = publishedExams?.[0]?.exam_link_token || "58d1d8986e0746f0b96ef7e83ab4a3f6";
  console.log(`Using exam link token: ${activeToken}`);

  const examLinkRes = await fetch(`${BASE_URL}/api/exam-link/${activeToken}`);
  const examLinkData = await examLinkRes.json();
  const examId = examLinkData.exam?.id || publishedExams?.[0]?.id;
  assert(!!examId, `Resolved published exam ID: ${examId}`);

  // Fetch or create an active attempt for candidate1
  const { data: existingAttempts } = await supabase
    .from("exam_attempts")
    .select("id, status, proctor_log")
    .eq("exam_id", examId)
    .eq("student_id", loginData.user.id)
    .order("started_at", { ascending: false });

  let attemptId = existingAttempts?.[0]?.id;
  assert(!!attemptId, `Found attempt ID for testing: ${attemptId}`);

  // 4. Test Logging Proctor Events via Candidate Session
  console.log("\nTest Group 3: Real-Time Proctor Event Persistence");

  // Event A: Fullscreen Exit
  const fsExitRes = await fetch(`${BASE_URL}/api/proctor/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: candidateCookie,
    },
    body: JSON.stringify({
      attempt_id: attemptId,
      event_type: "fullscreen_exit",
      timestamp: new Date().toISOString(),
      severity: "alert",
      details: { reason: "User pressed escape / exited browser fullscreen" },
    }),
  });
  const fsExitData = await fsExitRes.json();
  assert(fsExitRes.status === 200, `Fullscreen exit logged with status 200: got ${fsExitRes.status}`);
  assert(fsExitData.success === true, "Fullscreen exit logged successfully");

  // Event B: Head Turned Away (Gaze / Pose Deviation)
  const headTurnRes = await fetch(`${BASE_URL}/api/proctor/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: candidateCookie,
    },
    body: JSON.stringify({
      attempt_id: attemptId,
      event_type: "head_turned_away",
      timestamp: new Date().toISOString(),
      severity: "warning",
      details: { yawDeg: 34, message: "Candidate head turned away from display" },
    }),
  });
  const headTurnData = await headTurnRes.json();
  assert(headTurnRes.status === 200, `Head turn logged with status 200: got ${headTurnRes.status}`);
  assert(headTurnData.success === true, "Head turn saved in database");

  // Event C: Gaze Away
  const gazeRes = await fetch(`${BASE_URL}/api/proctor/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: candidateCookie,
    },
    body: JSON.stringify({
      attempt_id: attemptId,
      event_type: "gaze_away",
      timestamp: new Date().toISOString(),
      severity: "info",
      details: { horizontalGazeRatio: 0.18 },
    }),
  });
  const gazeData = await gazeRes.json();
  assert(gazeRes.status === 200, `Gaze deviation logged with status 200`);

  // Event D: Camera Disconnected
  const camRes = await fetch(`${BASE_URL}/api/proctor/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: candidateCookie,
    },
    body: JSON.stringify({
      attempt_id: attemptId,
      event_type: "camera_disconnected",
      timestamp: new Date().toISOString(),
      severity: "alert",
      details: { reason: "Video track ended / camera lost" },
    }),
  });
  const camData = await camRes.json();
  assert(camRes.status === 200, `Camera disconnected event logged with status 200`);

  // Event E: Batch Logging of Multiple Events
  console.log("\nTest Group 4: Batch Logging & Deduplication");
  const batchId1 = `batch_test_event_1_${Date.now()}`;
  const batchId2 = `batch_test_event_2_${Date.now()}`;
  const batchRes = await fetch(`${BASE_URL}/api/proctor/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: candidateCookie,
    },
    body: JSON.stringify({
      attempt_id: attemptId,
      events: [
        {
          id: batchId1,
          event_type: "tab_hidden",
          timestamp: new Date().toISOString(),
          severity: "warning",
          details: { reason: "User switched tab" },
        },
        {
          id: batchId2,
          event_type: "multiple_faces_detected",
          timestamp: new Date().toISOString(),
          severity: "alert",
          details: { faceCount: 2 },
        },
      ],
    }),
  });
  const batchData = await batchRes.json();
  assert(batchRes.status === 200, `Batch events logged with status 200`);
  assert(batchData.saved_count === 2, `Saved exactly 2 batch events`);

  // Test Deduplication: Re-send batchId1
  const dupRes = await fetch(`${BASE_URL}/api/proctor/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: candidateCookie,
    },
    body: JSON.stringify({
      attempt_id: attemptId,
      events: [
        {
          id: batchId1,
          event_type: "tab_hidden",
          timestamp: new Date().toISOString(),
          severity: "warning",
          details: { reason: "User switched tab" },
        },
      ],
    }),
  });
  const dupData = await dupRes.json();
  assert(dupRes.status === 200, "Duplicate request handled gracefully");
  assert(dupData.saved_count === 0, "Duplicate event was not duplicated (saved_count === 0)");

  // 5. Test Unauthorized Access Rejection
  console.log("\nTest Group 5: Security & Attempt Ownership Verification");
  const fakeAttemptId = "00000000-0000-0000-0000-000000000000";
  const unauthRes = await fetch(`${BASE_URL}/api/proctor/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: candidateCookie,
    },
    body: JSON.stringify({
      attempt_id: fakeAttemptId,
      event_type: "fullscreen_exit",
    }),
  });
  assert(unauthRes.status === 404, `Non-existent attempt rejected with 404: got ${unauthRes.status}`);

  // 6. Test Admin Results Dashboard Aggregation API
  console.log("\nTest Group 6: Admin Dashboard Aggregation & Warning Counters");
  const adminCookie = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token=${adminToken}`;
  const resultsRes = await fetch(`${BASE_URL}/api/results/${examId}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      Cookie: adminCookie,
    },
  });
  const resultsData = await resultsRes.json();

  assert(resultsRes.status === 200, `Admin results API responded with 200`);
  assert(Array.isArray(resultsData.attempts), `Retrieved attempts array`);

  const matchedAttempt = resultsData.attempts?.find((a) => a.id === attemptId);
  assert(!!matchedAttempt, `Found candidate attempt in admin results ledger`);

  if (matchedAttempt) {
    console.log(`  -> Warnings count in dashboard: ${matchedAttempt.warnings_count}`);
    console.log(`  -> Breakdown summary:`, matchedAttempt.proctor_log_summary);

    assert(matchedAttempt.warnings_count > 0, `Alerts count is > 0 (found ${matchedAttempt.warnings_count} alerts, NOT hardcoded 0)`);
    assert(matchedAttempt.proctor_log_summary.fullscreen_exits >= 1, `Fullscreen exits counted: ${matchedAttempt.proctor_log_summary.fullscreen_exits}`);
    assert(matchedAttempt.proctor_log_summary.head_turns >= 1, `Head turns counted: ${matchedAttempt.proctor_log_summary.head_turns}`);
    assert(matchedAttempt.proctor_log_summary.gaze_away >= 1, `Gaze deviations counted: ${matchedAttempt.proctor_log_summary.gaze_away}`);
    assert(matchedAttempt.proctor_log_summary.camera_disconnects >= 1, `Camera disconnects counted: ${matchedAttempt.proctor_log_summary.camera_disconnects}`);
    assert(matchedAttempt.proctor_log_summary.multiple_faces >= 1, `Multiple faces counted: ${matchedAttempt.proctor_log_summary.multiple_faces}`);
    assert(matchedAttempt.proctor_log_summary.tab_switches >= 1, `Tab switches counted: ${matchedAttempt.proctor_log_summary.tab_switches}`);

    // Verify rich metadata structure in proctor_log
    const sampleEvent = matchedAttempt.proctor_log.find((e) => e.event_type === "head_turned_away");
    assert(!!sampleEvent?.id, "Event contains unique id");
    assert(!!sampleEvent?.timestamp, "Event contains timestamp");
    assert(sampleEvent?.severity === "warning", `Event contains severity: ${sampleEvent?.severity}`);
    assert(sampleEvent?.details?.yawDeg === 34, "Event contains accurate details metadata (yawDeg: 34)");
  }

  // 7. Verify Attempt Detail Route
  console.log("\nTest Group 7: Attempt Detail Proctor Audit Verification");
  const detailRes = await fetch(`${BASE_URL}/api/results/${examId}/attempts/${attemptId}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      Cookie: adminCookie,
    },
  });
  const detailData = await detailRes.json();
  assert(detailRes.status === 200, `Attempt detail API responded with 200`);
  assert(Array.isArray(detailData.attempt?.proctor_log), "Attempt detail contains proctor_log array");
  assert(detailData.attempt?.proctor_log?.length > 0, `Proctor log array has ${detailData.attempt?.proctor_log?.length} events`);

  console.log("\n===============================================================");
  console.log(`  VERIFICATION RESULTS: ${passed}/${total} TESTS PASSED ✓`);
  console.log("===============================================================\n");
}

runVerification().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
