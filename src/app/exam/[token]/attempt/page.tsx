"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Timer,
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  Camera,
  AlertTriangle,
  Loader2,
  Shield,
  Maximize,
  AlertCircle,
  RotateCcw,
  CheckCircle,
  ScanFace,
  Users,
  Eye,
  UserX,
  VideoOff,
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  VisionProctorDetector,
  VisionAnalysisResult,
  isBlackOrEmptyFrame,
} from "@/lib/proctoring/vision-detector";

interface QuestionItem {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  question_order: number;
}

interface QuestionAnswerState {
  selected_option: string | null;
  is_marked_for_review: boolean;
  visited: boolean;
}

export default function ExamAttemptPage() {
  const routeParams = useParams();
  const token = (routeParams?.token as string) || "";
  const router = useRouter();
  const supabase = createClient();

  // Primary State
  const [examTitle, setExamTitle] = useState("Online Examination");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswerState>>({});
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Timer State
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Autosave State
  const dirtyAnswersRef = useRef<boolean>(false);
  const answersRef = useRef<Record<string, QuestionAnswerState>>({});
  answersRef.current = answers;

  // Camera & AI Vision Proctor State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraBlocked, setCameraBlocked] = useState<boolean>(false);
  const [cameraErrorDetail, setCameraErrorDetail] = useState<string>("");
  const detectorRef = useRef<VisionProctorDetector | null>(null);
  const visionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const [aiVisionResult, setAiVisionResult] = useState<VisionAnalysisResult | null>(null);
  const [proctorWarningsCount, setProctorWarningsCount] = useState<number>(0);
  const [activeWarningBanner, setActiveWarningBanner] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState<boolean>(true);

  useEffect(() => {
    const isSupported =
      typeof document !== "undefined" &&
      !!(
        document.fullscreenEnabled ||
        (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
      );
    setSupportsFullscreen(isSupported);
  }, []);

  // Proctoring Event Queue & Reliable Flush Worker
  const pendingEventsRef = useRef<
    Array<{
      id: string;
      attempt_id: string;
      event_type: string;
      timestamp: string;
      severity?: "alert" | "warning" | "info";
      details?: unknown;
    }>
  >([]);
  const isFlushingEventsRef = useRef<boolean>(false);

  const flushProctorEvents = useCallback(async () => {
    if (!attemptId || pendingEventsRef.current.length === 0 || isFlushingEventsRef.current) {
      return;
    }
    isFlushingEventsRef.current = true;
    const eventsToSend = [...pendingEventsRef.current];

    try {
      const res = await fetch("/api/proctor/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attempt_id: attemptId,
          events: eventsToSend,
        }),
      });

      if (res.ok) {
        // Remove successfully sent events from the queue
        const sentIds = new Set(eventsToSend.map((e) => e.id));
        pendingEventsRef.current = pendingEventsRef.current.filter((e) => !sentIds.has(e.id));
      } else {
        console.warn("Proctor event flush response status:", res.status);
      }
    } catch (e) {
      console.warn("Proctor event flush network notice:", e);
    } finally {
      isFlushingEventsRef.current = false;
    }
  }, [attemptId]);

  // Periodic flush interval (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingEventsRef.current.length > 0) {
        flushProctorEvents();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [flushProctorEvents]);

  // Proctoring Log function
  const logProctorEvent = useCallback(
    (
      eventType: string,
      details?: unknown,
      severity?: "alert" | "warning" | "info"
    ) => {
      if (!attemptId) return;

      const eventId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const inferredSeverity =
        severity ||
        (details && typeof details === "object" && "severity" in details
          ? (details as { severity?: "alert" | "warning" | "info" }).severity
          : undefined);

      const newEvent = {
        id: eventId,
        attempt_id: attemptId,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        severity: inferredSeverity,
        details,
      };

      pendingEventsRef.current.push(newEvent);

      // Trigger immediate background flush
      flushProctorEvents();
    },
    [attemptId, flushProctorEvents]
  );

  // Fullscreen Request Helper (with webkit prefix fallback)
  const enterFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else if ((document.documentElement as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
        await (document.documentElement as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        setIsFullscreen(true);
      }
    } catch (e) {
      console.warn("Fullscreen request notice:", e);
    }
  }, []);

  // 1. Initialize Exam Attempt & Questions
  useEffect(() => {
    async function initAttempt() {
      setIsInitializing(true);
      setInitError(null);

      try {
        const authRes = await fetch("/api/auth/candidate");
        const authData = await authRes.json();
        if (!authData.authenticated) {
          router.replace(`/exam/${token}`);
          return;
        }

        const infoRes = await fetch(`/api/exam-link/${token}`);
        const infoData = await infoRes.json();
        if (infoRes.ok && infoData?.exam?.title) {
          setExamTitle(infoData.exam.title);
        }

        const startRes = await fetch(`/api/exam-link/${token}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const startData = await startRes.json();

        if (!startRes.ok) {
          throw new Error(startData.error || "Failed to initialize examination");
        }

        const {
          attempt_id,
          questions: fetchedQuestions,
          saved_responses = [],
          started_at,
          duration_minutes = 60,
        } = startData;

        if (!fetchedQuestions || fetchedQuestions.length === 0) {
          throw new Error("No question paper generated for this exam.");
        }

        setAttemptId(attempt_id);
        setQuestions(fetchedQuestions);

        const answersMap: Record<string, QuestionAnswerState> = {};
        const savedMap = new Map<string, { selected_option: string | null; is_marked_for_review: boolean }>();

        saved_responses.forEach((sr: { question_id: string; selected_option: string | null; is_marked_for_review: boolean }) => {
          savedMap.set(sr.question_id, sr);
        });

        fetchedQuestions.forEach((q: QuestionItem, idx: number) => {
          const saved = savedMap.get(q.id);
          answersMap[q.id] = {
            selected_option: saved?.selected_option ?? null,
            is_marked_for_review: saved?.is_marked_for_review ?? false,
            visited: idx === 0 || !!saved?.selected_option || !!saved?.is_marked_for_review,
          };
        });

        setAnswers(answersMap);

        const totalDurationSec = (duration_minutes || 60) * 60;
        const elapsedSec = started_at
          ? Math.max(0, Math.floor((Date.now() - new Date(started_at).getTime()) / 1000))
          : 0;

        const leftSec = Math.max(0, totalDurationSec - elapsedSec);
        setRemainingSeconds(leftSec);

        enterFullscreen();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load examination";
        setInitError(msg);
      } finally {
        setIsInitializing(false);
      }
    }

    initAttempt();
  }, [token, router, supabase, enterFullscreen]);

  // Failure handler for camera disconnect / occlusion / track end
  const handleCameraFailure = useCallback(
    (reason: string) => {
      setCameraActive(false);
      setCameraBlocked(true);
      setCameraErrorDetail(reason);
      logProctorEvent("camera_disconnected", { reason });
      toast.error(`Mandatory Camera Interrupted: ${reason}. Test is locked until camera is restored.`);
    },
    [logProctorEvent]
  );

  // 2. Camera feed startup and AI Computer Vision Engine Integration
  const initCameraAndVision = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        handleCameraFailure("Webcam API not supported in browser");
        return;
      }

      // Stop previous tracks if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (visionIntervalRef.current) {
        clearInterval(visionIntervalRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: "user" },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        handleCameraFailure("No active video track provided by webcam.");
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Hardware lifecycle track listeners
      videoTrack.onended = () => {
        handleCameraFailure("Camera device ended or hardware disconnected");
      };
      videoTrack.onmute = () => {
        handleCameraFailure("Camera stream was muted by operating system");
      };

      setCameraActive(true);
      setCameraBlocked(false);
      setCameraErrorDetail("");
      logProctorEvent("camera_restored", { message: "Camera feed successfully active" });

      // Initialize Real-time AI Edge Computer Vision Detector
      const detector = new VisionProctorDetector((warning) => {
        setProctorWarningsCount((prev) => prev + 1);
        setActiveWarningBanner(warning.message);

        setTimeout(() => {
          setActiveWarningBanner((current) => (current === warning.message ? null : current));
        }, 6000);

        logProctorEvent(warning.type, {
          message: warning.message,
          severity: warning.severity,
          details: warning.details,
        });

        if (warning.severity === "alert") {
          toast.error(`Proctor Security Alert: ${warning.message}`, { duration: 6000 });
        } else {
          toast.warning(`Proctor Notice: ${warning.message}`, { duration: 5000 });
        }
      });

      const isReady = await detector.initialize();
      if (isReady) {
        detectorRef.current = detector;

        // Continuous analysis frame interval (every 400ms)
        visionIntervalRef.current = setInterval(() => {
          if (videoRef.current && detectorRef.current) {
            // Check black or empty frame
            if (isBlackOrEmptyFrame(videoRef.current)) {
              handleCameraFailure("Camera feed is pitch black or sensor is covered");
              return;
            }

            const res = detectorRef.current.analyzeFrame(videoRef.current);
            if (res) {
              setAiVisionResult(res);
            }
          }
        }, 400);
      } else {
        handleCameraFailure("Failed to initialize AI vision proctoring engine");
      }
    } catch (e) {
      console.warn("Attempt camera init notice:", e);
      handleCameraFailure(
        e instanceof Error ? e.message : "Camera permission denied or camera device busy"
      );
    }
  }, [handleCameraFailure, logProctorEvent]);

  // Initial trigger
  useEffect(() => {
    initCameraAndVision();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (visionIntervalRef.current) {
        clearInterval(visionIntervalRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, [initCameraAndVision]);

  // Watchdog monitoring active stream state
  useEffect(() => {
    cameraWatchdogRef.current = setInterval(() => {
      if (cameraActive && !cameraBlocked) {
        const stream = streamRef.current;
        const videoTrack = stream?.getVideoTracks()[0];
        if (!stream || !stream.active || !videoTrack || videoTrack.readyState !== "live") {
          handleCameraFailure("Webcam track dropped in background");
        } else if (videoRef.current && isBlackOrEmptyFrame(videoRef.current)) {
          handleCameraFailure("Webcam produced pitch-black frames");
        }
      }
    }, 1500);

    return () => {
      if (cameraWatchdogRef.current) clearInterval(cameraWatchdogRef.current);
    };
  }, [cameraActive, cameraBlocked, handleCameraFailure]);

  // 3. Proctoring Event Listeners (Tab change & Fullscreen change)
  useEffect(() => {
    if (!attemptId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setProctorWarningsCount((prev) => prev + 1);
        setActiveWarningBanner("Leaving exam window / tab switch logged");
        logProctorEvent("tab_hidden", { reason: "User switched tab or minimized window" });
        toast.warning("Warning: Leaving exam window is recorded in the proctor audit log.", {
          duration: 5000,
        });
      } else {
        logProctorEvent("tab_visible", { reason: "User returned to exam window" });
      }
    };

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && supportsFullscreen) {
        setProctorWarningsCount((prev) => prev + 1);
        setActiveWarningBanner("Fullscreen mode exited");
        logProctorEvent("fullscreen_exit", { reason: "User exited fullscreen mode" });
        toast.error("Proctor Alert: Fullscreen exited! Please restore fullscreen immediately.", {
          duration: 6000,
        });
      } else if (isCurrentlyFullscreen) {
        logProctorEvent("fullscreen_enter", { reason: "Fullscreen active" });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [attemptId, logProctorEvent, supportsFullscreen]);

  // 4. Autosave Routine
  const saveResponses = useCallback(
    async (isForce = false) => {
      if (!attemptId) return;
      if (!isForce && !dirtyAnswersRef.current) return;

      const currentAnswers = answersRef.current;
      const responsesPayload = Object.entries(currentAnswers).map(
        ([qId, state]) => ({
          question_id: qId,
          selected_option: state.selected_option,
          is_marked_for_review: state.is_marked_for_review,
        })
      );

      try {
        const res = await fetch(`/api/exam-link/${token}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attempt_id: attemptId,
            responses: responsesPayload,
          }),
        });

        if (res.ok) {
          dirtyAnswersRef.current = false;
        }
      } catch (e) {
        console.error("Autosave failed", e);
      }
    },
    [attemptId, token]
  );

  // Autosave interval every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveResponses(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [saveResponses]);

  // 5. Final Submit Function
  const handleSubmitExam = useCallback(
    async (isAuto = false) => {
      if (!attemptId || isSubmitting) return;
      setIsSubmitting(true);

      try {
        await saveResponses(true);
        await flushProctorEvents();

        const res = await fetch(`/api/exam-link/${token}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attempt_id: attemptId,
            is_auto_submitted: isAuto,
            proctor_events: pendingEventsRef.current,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Submission failed");
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (detectorRef.current) {
          detectorRef.current.dispose();
        }

        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        }

        toast.success(isAuto ? "Exam duration ended. Auto-submitted successfully!" : "Exam submitted successfully!");
        router.push(`/exam/${token}/result?attempt_id=${attemptId}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error submitting exam";
        toast.error(msg);
        setIsSubmitting(false);
      }
    },
    [attemptId, isSubmitting, saveResponses, flushProctorEvents, token, router]
  );

  // 6. Countdown Timer
  useEffect(() => {
    if (remainingSeconds === null) return;

    if (remainingSeconds <= 0) {
      handleSubmitExam(true);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          handleSubmitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [remainingSeconds, handleSubmitExam]);

  // Handle Question selection change
  const handleSelectOption = (option: string) => {
    if (cameraBlocked) {
      toast.error("Answering locked. Restore camera monitoring to continue.");
      return;
    }
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setAnswers((prev) => {
      const existing = prev[currentQ.id] || {
        selected_option: null,
        is_marked_for_review: false,
        visited: true,
      };

      const updated = {
        ...prev,
        [currentQ.id]: {
          ...existing,
          selected_option: option,
          visited: true,
        },
      };

      dirtyAnswersRef.current = true;
      return updated;
    });
  };

  const handleClearOption = () => {
    if (cameraBlocked) {
      toast.error("Answering locked. Restore camera monitoring to continue.");
      return;
    }
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setAnswers((prev) => {
      const existing = prev[currentQ.id];
      if (!existing) return prev;

      const updated = {
        ...prev,
        [currentQ.id]: {
          ...existing,
          selected_option: null,
          visited: true,
        },
      };

      dirtyAnswersRef.current = true;
      return updated;
    });
  };

  const handleToggleReview = (checked: boolean) => {
    if (cameraBlocked) {
      toast.error("Action locked. Restore camera monitoring to continue.");
      return;
    }
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setAnswers((prev) => {
      const existing = prev[currentQ.id] || {
        selected_option: null,
        is_marked_for_review: false,
        visited: true,
      };

      const updated = {
        ...prev,
        [currentQ.id]: {
          ...existing,
          is_marked_for_review: checked,
          visited: true,
        },
      };

      dirtyAnswersRef.current = true;
      return updated;
    });
  };

  const goToQuestion = (idx: number) => {
    if (idx < 0 || idx >= questions.length) return;
    const targetQ = questions[idx];

    setAnswers((prev) => ({
      ...prev,
      [targetQ.id]: {
        ...(prev[targetQ.id] || {
          selected_option: null,
          is_marked_for_review: false,
        }),
        visited: true,
      },
    }));

    setCurrentIndex(idx);
  };

  const formatTimer = (secs: number | null) => {
    if (secs === null) return "--:--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;

  let answeredCount = 0;
  let reviewCount = 0;
  let unansweredCount = 0;

  questions.forEach((q) => {
    const ans = answers[q.id];
    if (ans?.selected_option) {
      answeredCount += 1;
    } else {
      unansweredCount += 1;
    }
    if (ans?.is_marked_for_review) {
      reviewCount += 1;
    }
  });

  const isLowTime = remainingSeconds !== null && remainingSeconds < 300;

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="size-10 text-[#0071E3] animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Securing Exam Environment...</h2>
        <p className="text-xs text-[#6E6E73] mt-1 max-w-sm">
          Randomizing questions, calibrating computer vision proctoring, and creating attempt ledger.
        </p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full border-[#FF3B30]/30 bg-white text-center p-6 shadow-sm rounded-2xl">
          <AlertCircle className="size-10 text-[#FF3B30] mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[#1D1D1F]">Exam Initialization Error</h2>
          <p className="text-xs text-[#6E6E73] mt-2">{initError}</p>
          <Button
            onClick={() => router.push(`/exam/${token}`)}
            className="mt-6 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs rounded-xl"
          >
            Return to Exam Portal
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col select-none">
      {/* 1. Header Toolbar */}
      <header className="h-16 border-b border-[#D2D2D7] bg-white sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-[#0071E3] text-white flex items-center justify-center shadow-sm">
            <Shield className="size-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-[#1D1D1F] tracking-tight truncate max-w-[200px] sm:max-w-md">
              {examTitle}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-[#6E6E73]">
              <span className="font-medium text-[#1D1D1F]">Q {currentIndex + 1} of {questions.length}</span>
              <span>•</span>
              {cameraBlocked ? (
                <span className="text-[#D70015] font-semibold flex items-center gap-1 bg-[#FF3B30]/10 px-2 py-0.5 rounded-full border border-[#FF3B30]/30">
                  <span className="size-1.5 rounded-full bg-[#FF3B30] animate-ping" />
                  Camera Blocked
                </span>
              ) : cameraActive && aiVisionResult?.status === "verified" ? (
                <span className="text-[#1E7E34] font-semibold flex items-center gap-1 bg-[#34C759]/10 px-2 py-0.5 rounded-full border border-[#34C759]/30">
                  <span className="size-1.5 rounded-full bg-[#34C759] animate-pulse" />
                  AI Proctor Active
                </span>
              ) : cameraActive ? (
                <span className="text-[#B25E00] font-semibold flex items-center gap-1 bg-[#FF9500]/10 px-2 py-0.5 rounded-full border border-[#FF9500]/30">
                  <span className="size-1.5 rounded-full bg-[#FF9500]" />
                  AI Monitoring ({aiVisionResult?.status ? aiVisionResult.status.replace(/_/g, " ") : "Calibrating"})
                </span>
              ) : (
                <span className="text-[#D70015] font-semibold flex items-center gap-1 bg-[#FF3B30]/10 px-2 py-0.5 rounded-full border border-[#FF3B30]/30">
                  <span className="size-1.5 rounded-full bg-[#FF3B30]" />
                  Proctor Inactive
                </span>
              )}
              {proctorWarningsCount > 0 && (
                <span className="text-[#B25E00] font-semibold bg-[#FF9500]/10 px-2 py-0.5 rounded-full border border-[#FF9500]/30">
                  {proctorWarningsCount} {proctorWarningsCount === 1 ? "Notice" : "Notices"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Fullscreen Warning Toggle */}
        {!isFullscreen && supportsFullscreen && (
          <Button
            size="sm"
            variant="outline"
            onClick={enterFullscreen}
            className="hidden md:flex border-[#FF9500]/40 bg-[#FF9500]/10 text-[#B25E00] hover:bg-[#FF9500]/20 text-xs h-8 font-medium rounded-lg"
          >
            <Maximize className="size-3.5 mr-1.5 text-[#FF9500]" />
            Restore Fullscreen
          </Button>
        )}

        {/* Right: Timer & Submit Action */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono font-bold text-sm tracking-wide ${
              isLowTime
                ? "bg-[#FF3B30]/10 border-[#FF3B30]/40 text-[#D70015] animate-pulse"
                : "bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F]"
            }`}
          >
            <Timer className={`size-4 ${isLowTime ? "text-[#FF3B30]" : "text-[#0071E3]"}`} />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <Button
            onClick={() => setShowSubmitDialog(true)}
            size="sm"
            className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold shadow-sm h-9 px-4 text-xs rounded-xl transition-colors"
          >
            <Send className="size-3.5 mr-1.5" />
            <span>Submit</span>
          </Button>
        </div>
      </header>

      {/* Floating Active Warning Banner if Anomaly Occurs */}
      {activeWarningBanner && (
        <div className="bg-[#FF9500]/15 border-b border-[#FF9500]/30 text-[#B25E00] py-2 px-4 text-xs flex items-center justify-between sticky top-16 z-30 backdrop-blur-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <AlertTriangle className="size-4 text-[#FF9500] shrink-0" />
            <span className="font-medium">
              Candidate Notice: {activeWarningBanner}. Please focus on the screen to avoid integrity flags.
            </span>
          </div>
        </div>
      )}

      {/* 2. Main Exam Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Question Display (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-4 relative">
          {/* Answering Lock Overlay when Camera is disconnected */}
          {cameraBlocked && (
            <div className="absolute inset-0 z-30 bg-white/98 backdrop-blur-md rounded-2xl border-2 border-[#FF3B30] p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl">
              <div className="size-16 rounded-full bg-[#FF3B30]/10 border border-[#FF3B30]/30 flex items-center justify-center text-[#FF3B30] animate-pulse">
                <VideoOff className="size-8" />
              </div>
              <div className="space-y-2 max-w-md">
                <h2 className="text-xl font-bold text-[#1D1D1F] tracking-tight">
                  Camera Monitoring Interrupted — Answering Locked
                </h2>
                <p className="text-xs text-[#D70015] font-semibold">
                  {cameraErrorDetail || "Continuous web camera feed is disconnected or unavailable."}
                </p>
                <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                  Video proctoring is strictly mandatory throughout this examination. Answering and navigation are blocked until camera access is restored.
                </p>
                <div className="p-3 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20 text-xs text-[#B25E00] flex items-center justify-center gap-2 font-medium">
                  <Clock className="size-4 shrink-0" />
                  <span>Important: Examination timer continues to run while monitoring is interrupted.</span>
                </div>
              </div>
              <Button
                onClick={initCameraAndVision}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs shadow-sm px-6 py-2.5 rounded-xl mt-2"
              >
                <RefreshCw className="size-3.5 mr-2" />
                Reconnect Camera & Resume
              </Button>
            </div>
          )}
          {currentQ && (
            <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-[#D2D2D7]/80 bg-[#F5F5F7]/40 pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/30 text-xs px-2.5 py-0.5 font-semibold rounded-full">
                      Question {currentIndex + 1}
                    </Badge>
                    <span className="text-xs text-[#6E6E73] font-medium">
                      Single Choice (+4 / -1)
                    </span>
                  </div>

                  <label
                    htmlFor="review-checkbox"
                    className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-[#424245] hover:text-[#1D1D1F]"
                  >
                    <Checkbox
                      id="review-checkbox"
                      checked={currentAnswer?.is_marked_for_review ?? false}
                      onCheckedChange={(checked) => handleToggleReview(Boolean(checked))}
                      className="border-[#FF9500] data-[state=checked]:bg-[#FF9500] data-[state=checked]:border-[#FF9500]"
                    />
                    <span className="flex items-center gap-1 text-[#B25E00]">
                      <Flag className="size-3.5 fill-[#FF9500]/30" />
                      Mark for Review
                    </span>
                  </label>
                </div>

                <div className="pt-3">
                  <CardTitle className="text-base sm:text-lg font-medium leading-relaxed text-[#1D1D1F] whitespace-pre-wrap">
                    {currentQ.question_text}
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="pt-6 pb-6 space-y-3">
                {[
                  { key: "A", text: currentQ.option_a },
                  { key: "B", text: currentQ.option_b },
                  { key: "C", text: currentQ.option_c },
                  { key: "D", text: currentQ.option_d },
                ].map((opt) => {
                  const isSelected = currentAnswer?.selected_option === opt.key;
                  return (
                    <div
                      key={opt.key}
                      onClick={() => handleSelectOption(opt.key)}
                      className={`group flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#0071E3] bg-[#0071E3]/5 text-[#1D1D1F] shadow-sm ring-1 ring-[#0071E3]"
                          : "border-[#D2D2D7] bg-white hover:border-[#86868B] hover:bg-[#F5F5F7] text-[#1D1D1F]"
                      }`}
                    >
                      <div
                        className={`size-7 rounded-full flex items-center justify-center shrink-0 font-bold text-xs transition-colors ${
                          isSelected
                            ? "bg-[#0071E3] text-white"
                            : "bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] group-hover:border-[#86868B] group-hover:text-[#1D1D1F]"
                        }`}
                      >
                        {opt.key}
                      </div>
                      <div className="text-sm pt-0.5 leading-relaxed break-words flex-1 font-normal">
                        {opt.text}
                      </div>
                    </div>
                  );
                })}
              </CardContent>

              <div className="p-4 bg-[#F5F5F7]/40 border-t border-[#D2D2D7] flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearOption}
                  disabled={!currentAnswer?.selected_option}
                  className="text-[#6E6E73] hover:text-[#FF3B30] hover:bg-[#F5F5F7] text-xs font-medium"
                >
                  <RotateCcw className="size-3.5 mr-1.5" />
                  Clear Response
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToQuestion(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs font-medium rounded-lg h-9 shadow-sm"
                  >
                    <ChevronLeft className="size-4 mr-1" />
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToQuestion(currentIndex + 1)}
                    disabled={currentIndex === questions.length - 1}
                    className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs font-medium rounded-lg h-9 shadow-sm"
                  >
                    Next
                    <ChevronRight className="size-4 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Panel: Sidebar (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* 1. Real-time AI Proctoring Feed & HUD */}
          <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="py-2.5 px-4 border-b border-[#D2D2D7]/80 bg-[#F5F5F7]/40 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                <ScanFace className="size-3.5 text-[#0071E3]" />
                AI Vision Proctor
              </span>
              <div className="flex items-center gap-2">
                {cameraBlocked ? (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5 flex items-center gap-1 bg-[#FF3B30]/10 text-[#D70015] border-[#FF3B30]/30">
                    <VideoOff className="size-2.5" /> Disconnected
                  </Badge>
                ) : aiVisionResult?.status === "multiple_faces" ? (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5 flex items-center gap-1 bg-[#FF3B30]/10 text-[#D70015] border-[#FF3B30]/30">
                    <Users className="size-2.5" /> Multi-Face
                  </Badge>
                ) : aiVisionResult?.status === "no_face" ? (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-[#D70015] border-[#FF3B30]/30 bg-[#FF3B30]/10">
                    <UserX className="size-2.5 mr-0.5" /> No Face
                  </Badge>
                ) : aiVisionResult?.status === "head_turned" || aiVisionResult?.status === "looking_down" ? (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-[#B25E00] border-[#FF9500]/30 bg-[#FF9500]/10">
                    Look Forward
                  </Badge>
                ) : cameraActive && aiVisionResult?.status === "verified" ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-[#1E7E34] font-semibold">
                    <span className="size-2 rounded-full bg-[#34C759] animate-pulse" />
                    Verified
                  </span>
                ) : (
                  <span className="text-[10px] text-[#6E6E73] font-medium">
                    Initializing...
                  </span>
                )}
              </div>
            </CardHeader>

            <div className="bg-black relative aspect-[4/3] max-h-52 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`size-full object-cover transform -scale-x-100 ${
                  cameraActive && !cameraBlocked ? "block" : "hidden"
                }`}
              />

              {cameraBlocked && (
                <div className="absolute inset-0 z-20 bg-white/95 flex flex-col items-center justify-center p-3 text-center space-y-2">
                  <VideoOff className="size-6 text-[#FF3B30] animate-pulse" />
                  <span className="text-xs font-semibold text-[#1D1D1F]">Camera Feed Lost</span>
                  <span className="text-[10px] text-[#6E6E73]">Monitoring interrupted</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={initCameraAndVision}
                    className="text-xs h-7 border-[#FF3B30]/30 text-[#D70015] hover:bg-[#FF3B30]/10 rounded-lg"
                  >
                    <RefreshCw className="size-3 mr-1" /> Reconnect
                  </Button>
                </div>
              )}

              {/* Edge AI Vision HUD Overlays */}
              {cameraActive && aiVisionResult && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2">
                  {/* Top telemetry pills */}
                  <div className="flex items-center justify-between text-[9px] text-[#1D1D1F]">
                    <span className="bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-[#D2D2D7] font-medium shadow-sm">
                      Faces: {aiVisionResult.faceCount}
                    </span>
                    <span className="bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-[#D2D2D7] font-mono shadow-sm">
                      Y:{aiVisionResult.headPose.yawDeg}° P:{aiVisionResult.headPose.pitchDeg}°
                    </span>
                  </div>

                  {/* Centered bounding box guidance */}
                  <div className="flex items-center justify-center">
                    <div
                      className={`w-28 h-36 rounded-[40%] border border-dashed transition-colors ${
                        aiVisionResult.status === "multiple_faces"
                          ? "border-[#FF3B30] bg-[#FF3B30]/10"
                          : aiVisionResult.status === "head_turned" || aiVisionResult.status === "looking_down"
                          ? "border-[#FF9500] bg-[#FF9500]/10"
                          : aiVisionResult.status === "no_face"
                          ? "border-[#FF3B30]/70 bg-[#FF3B30]/5"
                          : "border-[#34C759]/70"
                      }`}
                    />
                  </div>

                  {/* Bottom status message */}
                  <div className="text-center">
                    <span
                      className={`inline-block text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm font-semibold shadow-sm ${
                        aiVisionResult.status === "multiple_faces"
                          ? "bg-white text-[#D70015] border border-[#FF3B30]/40"
                          : aiVisionResult.status === "no_face"
                          ? "bg-white text-[#D70015] border border-[#FF3B30]/40"
                          : aiVisionResult.status === "head_turned" || aiVisionResult.status === "looking_down"
                          ? "bg-white text-[#B25E00] border border-[#FF9500]/40"
                          : "bg-white text-[#1E7E34] border border-[#34C759]/40"
                      }`}
                    >
                      {aiVisionResult.statusMessage}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Proctor Alert Audit Strip */}
            <div className="py-2 px-3 bg-[#F5F5F7] border-t border-[#D2D2D7] flex items-center justify-between text-[11px] text-[#6E6E73]">
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#1D1D1F]">
                <Shield className="size-3 text-[#0071E3]" />
                Edge AI Proctoring
              </span>
              <span className="text-[10px] font-mono text-[#6E6E73]">
                {proctorWarningsCount} Integrity Flags
              </span>
            </div>
          </Card>

          {/* 2. Question Navigation Grid (Quizrr UX) */}
          <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-[#D2D2D7]/80 bg-[#F5F5F7]/40">
              <CardTitle className="text-xs font-bold text-[#1D1D1F]">
                Question Palette
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4">
              <ScrollArea className="max-h-[300px] pr-2">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const ans = answers[q.id];
                    const isCurrent = idx === currentIndex;
                    const isAnswered = !!ans?.selected_option;
                    const isReview = ans?.is_marked_for_review;
                    const isVisited = ans?.visited;

                    let bgClasses = "bg-white text-[#86868B] border border-[#D2D2D7]";

                    if (isReview && isAnswered) {
                      bgClasses = "bg-[#5856D6] text-white border border-[#5856D6]";
                    } else if (isReview) {
                      bgClasses = "bg-[#FF9500] text-white border border-[#FF9500]";
                    } else if (isAnswered) {
                      bgClasses = "bg-[#34C759] text-white border border-[#34C759]";
                    } else if (isVisited) {
                      bgClasses = "bg-[#E8E8ED] text-[#1D1D1F] border border-[#D2D2D7]";
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToQuestion(idx)}
                        className={`size-9 rounded-lg font-bold text-xs flex items-center justify-center border transition-all ${bgClasses} ${
                          isCurrent
                            ? "ring-2 ring-[#0071E3] ring-offset-2 ring-offset-white scale-105"
                            : "hover:opacity-90"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-[#D2D2D7] space-y-2 text-[11px] text-[#6E6E73]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-[#34C759] shrink-0" />
                    <span>Answered ({answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-[#FF9500] shrink-0" />
                    <span>Review ({reviewCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-[#E8E8ED] border border-[#D2D2D7] shrink-0" />
                    <span>Unanswered ({unansweredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-white border border-[#D2D2D7] shrink-0" />
                    <span>Not Visited</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="border-[#D2D2D7] bg-white text-[#1D1D1F] sm:max-w-md rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1D1D1F] flex items-center gap-2">
              <AlertTriangle className="size-5 text-[#FF9500]" />
              Confirm Examination Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6E6E73]">
              Are you sure you want to finalize your exam attempt? Once submitted, your answers cannot be altered.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 py-3 text-center text-xs">
            <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
              <span className="text-[#6E6E73] block text-[10px] font-medium">Answered</span>
              <span className="text-base font-bold text-[#1E7E34]">{answeredCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
              <span className="text-[#6E6E73] block text-[10px] font-medium">Under Review</span>
              <span className="text-base font-bold text-[#B25E00]">{reviewCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
              <span className="text-[#6E6E73] block text-[10px] font-medium">Unanswered</span>
              <span className="text-base font-bold text-[#6E6E73]">{unansweredCount}</span>
            </div>
          </div>

          {unansweredCount > 0 && (
            <p className="text-[11px] text-[#B25E00] bg-[#FF9500]/10 p-3 rounded-xl border border-[#FF9500]/20 font-medium">
              Notice: You have {unansweredCount} unanswered questions. Unanswered questions will receive 0 marks.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubmitDialog(false)}
              className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl text-xs font-medium"
            >
              Resume Test
            </Button>
            <Button
              size="sm"
              onClick={() => handleSubmitExam(false)}
              disabled={isSubmitting}
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  Finalizing & Grading...
                </>
              ) : (
                "Confirm & Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
