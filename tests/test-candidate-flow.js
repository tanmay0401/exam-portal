/**
 * End-to-End Candidate Authentication & Exam Flow Verification
 */

const BASE_URL = "http://localhost:3005";
const TOKEN = "0dce5c334ca046feaae357318669658f";

async function runTests() {
  console.log("===============================================================");
  console.log("  CANDIDATE AUTHENTICATION & EXAM LIFECYCLE VERIFICATION  ");
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

  // 1. Test invalid password rejection
  console.log("Test 1: Reject Invalid Candidate Password");
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      email: "candidate1@examportal.com",
      password: "CompletelyWrongPassword@999",
    }),
  });
  const badLoginData = await badLoginRes.json();
  assert(badLoginRes.status === 401, `Status is 401: got ${badLoginRes.status}`);
  assert(
    badLoginData.error && badLoginData.error.toLowerCase().includes("invalid"),
    `Returns invalid credentials error: "${badLoginData.error}"`
  );

  // 2. Test candidate login with CandidatePassword@123
  console.log("\nTest 2: Candidate Login with CandidatePassword@123");
  const loginRes1 = await fetch(`${BASE_URL}/api/auth/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      email: "candidate1@examportal.com",
      password: "CandidatePassword@123",
    }),
  });
  const loginData1 = await loginRes1.json();
  const setCookieHeader1 = loginRes1.headers.get("set-cookie") || "";

  assert(loginRes1.status === 200, `Login status is 200: got ${loginRes1.status}`);
  assert(loginData1.success === true, "Login success is true");
  assert(loginData1.user?.email === "candidate1@examportal.com", `User email is candidate1@examportal.com`);
  assert(setCookieHeader1.includes("candidate_session="), "candidate_session cookie was issued");

  // Extract candidate cookie
  const cookieMatch = setCookieHeader1.match(/candidate_session=[^;]+/);
  const cookieHeader = cookieMatch ? cookieMatch[0] : "";

  // 3. Test candidate login with StudentPassword@123
  console.log("\nTest 3: Candidate Login with StudentPassword@123");
  const loginRes2 = await fetch(`${BASE_URL}/api/auth/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      email: "candidate1@examportal.com",
      password: "StudentPassword@123",
    }),
  });
  const loginData2 = await loginRes2.json();
  assert(loginRes2.status === 200, `Status is 200 for StudentPassword@123: got ${loginRes2.status}`);
  assert(loginData2.user?.email === "candidate1@examportal.com", "Resolved candidate profile");

  // 4. Test candidate login with student@examportal.com
  console.log("\nTest 4: Candidate Login with student@examportal.com");
  const studentLoginRes = await fetch(`${BASE_URL}/api/auth/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      email: "student@examportal.com",
      password: "StudentPassword@123",
    }),
  });
  const studentData = await studentLoginRes.json();
  assert(studentLoginRes.status === 200, `Status is 200 for student@examportal.com: got ${studentLoginRes.status}`);
  assert(studentData.user?.email === "student@examportal.com", "Resolved student profile");

  // 5. Verify Candidate Auth Status GET endpoint
  console.log("\nTest 5: Verify Auth Status with candidate_session Cookie");
  const checkAuthRes = await fetch(`${BASE_URL}/api/auth/candidate`, {
    headers: { Cookie: cookieHeader },
  });
  const checkAuthData = await checkAuthRes.json();
  assert(checkAuthRes.status === 200, "Auth check returned 200");
  assert(checkAuthData.authenticated === true, "authenticated is true");
  assert(checkAuthData.user?.email === "candidate1@examportal.com", "User email verified from cookie");

  // 6. Verify exam-link metadata returns authenticated_user
  console.log("\nTest 6: Verify Exam Link Resolution with Candidate Cookie");
  const examLinkRes = await fetch(`${BASE_URL}/api/exam-link/${TOKEN}`, {
    headers: { Cookie: cookieHeader },
  });
  const examLinkData = await examLinkRes.json();
  assert(examLinkRes.status === 200, "Exam link route returned 200");
  assert(examLinkData.exam?.id !== undefined, "Exam metadata returned");
  assert(examLinkData.authenticated_user?.email === "candidate1@examportal.com", "Authenticated candidate identified on exam link");

  // 7. Verify start exam endpoint creates or resumes attempt
  console.log("\nTest 7: Start Examination with Candidate Cookie");
  const startRes = await fetch(`${BASE_URL}/api/exam-link/${TOKEN}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
  });
  const startData = await startRes.json();
  assert(startRes.status === 200 || (startRes.status === 400 && startData.error?.includes("already completed")), `Start response status is ${startRes.status}`);

  if (startRes.status === 200) {
    assert(!!startData.attempt_id, `Attempt created or resumed: ID ${startData.attempt_id}`);
    assert(Array.isArray(startData.questions) && startData.questions.length > 0, `Returned ${startData.questions?.length} questions`);

    const attemptId = startData.attempt_id;
    const firstQ = startData.questions[0];

    // 8. Save responses
    console.log("\nTest 8: Save Question Response");
    const saveRes = await fetch(`${BASE_URL}/api/exam-link/${TOKEN}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        attempt_id: attemptId,
        responses: [
          {
            question_id: firstQ.id,
            selected_option: "A",
            is_marked_for_review: false,
          },
        ],
      }),
    });
    const saveData = await saveRes.json();
    assert(saveRes.status === 200, `Save status 200: got ${saveRes.status}`);
    assert(saveData.success === true, "Response successfully saved");

    // 9. Submit Attempt
    console.log("\nTest 9: Submit Examination Attempt");
    const submitRes = await fetch(`${BASE_URL}/api/exam-link/${TOKEN}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        attempt_id: attemptId,
        is_auto_submitted: false,
      }),
    });
    const submitData = await submitRes.json();
    assert(submitRes.status === 200, `Submit status 200: got ${submitRes.status}`);
    assert(submitData.success === true, "Submission marked successfully");
    assert(typeof submitData.score === "number", `Calculated server-side score: ${submitData.score}`);

    // 10. Result Page Payload
    console.log("\nTest 10: Fetch Result Scorecard Payload");
    const resultRes = await fetch(`${BASE_URL}/api/exam-link/${TOKEN}/result?attempt_id=${attemptId}`, {
      headers: { Cookie: cookieHeader },
    });
    const resultData = await resultRes.json();
    assert(resultRes.status === 200, `Result status 200: got ${resultRes.status}`);
    assert(resultData.student_email === "candidate1@examportal.com", "Result scorecard has student_email");
    assert(typeof resultData.score === "number", `Scorecard score: ${resultData.score}`);

    // 11. Prevent Retake
    console.log("\nTest 11: Enforce Single Attempt Policy");
    const retakeRes = await fetch(`${BASE_URL}/api/exam-link/${TOKEN}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
    });
    const retakeData = await retakeRes.json();
    assert(retakeRes.status === 400, `Retake blocked with status 400: got ${retakeRes.status}`);
    assert(retakeData.error?.includes("already completed"), `Retake blocked with message: "${retakeData.error}"`);
  }

  console.log("\n===============================================================");
  console.log(`  VERIFICATION RESULTS: ${passed}/${total} TESTS PASSED ✓`);
  console.log("===============================================================\n");
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
