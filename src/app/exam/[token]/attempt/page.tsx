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
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="size-12 text-indigo-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold">Securing Exam Environment...</h2>
        <p className="text-xs text-slate-400 mt-1">
          Randomizing questions, calibrating computer vision proctoring, and creating attempt ledger.
        </p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full border-rose-900/60 bg-rose-950/20 text-center p-6">
          <AlertCircle className="size-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-rose-200">Exam Initialization Error</h2>
          <p className="text-xs text-rose-300/80 mt-2">{initError}</p>
          <Button
            onClick={() => router.push(`/exam/${token}`)}
            className="mt-6 bg-slate-800 hover:bg-slate-700 text-white"
          >
            Return to Exam Portal
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* 1. Header Toolbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield className="size-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
              {examTitle}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Q {currentIndex + 1} of {questions.length}</span>
              <span>•</span>
              {cameraBlocked ? (
                <span className="text-rose-400 font-semibold flex items-center gap-1 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30">
                  <span className="size-1.5 rounded-full bg-rose-500 animate-ping" />
                  Camera Blocked
                </span>
              ) : cameraActive && aiVisionResult?.status === "verified" ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI Proctor Active
                </span>
              ) : cameraActive ? (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  AI Monitoring ({aiVisionResult?.status ? aiVisionResult.status.replace(/_/g, " ") : "Calibrating"})
                </span>
              ) : (
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-rose-400" />
                  Proctor Inactive
                </span>
              )}
              {proctorWarningsCount > 0 && (
                <span className="text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
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
            className="hidden md:flex border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs h-8"
          >
            <Maximize className="size-3.5 mr-1.5" />
            Restore Fullscreen
          </Button>
        )}

        {/* Right: Timer & Submit Action */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm tracking-wide ${
              isLowTime
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-200"
            }`}
          >
            <Timer className={`size-4 ${isLowTime ? "text-rose-400" : "text-indigo-400"}`} />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <Button
            onClick={() => setShowSubmitDialog(true)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/20 h-9 px-4"
          >
            <Send className="size-3.5 mr-1.5" />
            <span>Submit</span>
          </Button>
        </div>
      </header>

      {/* Floating Active Warning Banner if Anomaly Occurs */}
      {activeWarningBanner && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 py-2 px-4 text-xs flex items-center justify-between sticky top-16 z-30 backdrop-blur-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <AlertTriangle className="size-4 text-amber-400 shrink-0" />
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
            <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-md rounded-xl border border-rose-900/60 p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl">
              <div className="size-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 animate-pulse">
                <VideoOff className="size-8" />
              </div>
              <div className="space-y-2 max-w-md">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Camera Monitoring Interrupted — Answering Locked
                </h2>
                <p className="text-xs text-rose-300 font-medium">
                  {cameraErrorDetail || "Continuous web camera feed is disconnected or unavailable."}
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Video proctoring is strictly mandatory throughout this examination. Answering and navigation are blocked until camera access is restored.
                </p>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-center gap-2 font-medium">
                  <Clock className="size-4 shrink-0" />
                  <span>Important: Examination timer continues to run while monitoring is interrupted.</span>
                </div>
              </div>
              <Button
                onClick={initCameraAndVision}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 px-6 py-2.5 mt-2"
              >
                <RefreshCw className="size-3.5 mr-2" />
                Reconnect Camera & Resume
              </Button>
            </div>
          )}
          {currentQ && (
            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
              <CardHeader className="border-b border-slate-800/80 pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white text-xs px-2.5 py-0.5">
                      Question {currentIndex + 1}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      Single Choice (+4 / -1)
                    </span>
                  </div>

                  <label
                    htmlFor="review-checkbox"
                    className="flex items-center gap-2 text-xs font-medium cursor-pointer text-slate-300 hover:text-white"
                  >
                    <Checkbox
                      id="review-checkbox"
                      checked={currentAnswer?.is_marked_for_review ?? false}
                      onCheckedChange={(checked) => handleToggleReview(Boolean(checked))}
                      className="border-amber-400 data-checked:bg-amber-500 data-checked:border-amber-500"
                    />
                    <span className="flex items-center gap-1 text-amber-300">
                      <Flag className="size-3.5 fill-amber-300/30" />
                      Mark for Review
                    </span>
                  </label>
                </div>

                <div className="pt-3">
                  <CardTitle className="text-base sm:text-lg font-normal leading-relaxed text-slate-100 whitespace-pre-wrap">
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
                          ? "border-indigo-500 bg-indigo-600/15 shadow-sm shadow-indigo-500/20 text-white"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60 text-slate-300"
                      }`}
                    >
                      <div
                        className={`size-7 rounded-full flex items-center justify-center shrink-0 font-bold text-xs transition-colors ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200"
                        }`}
                      >
                        {opt.key}
                      </div>
                      <div className="text-sm pt-0.5 leading-relaxed break-words flex-1">
                        {opt.text}
                      </div>
                    </div>
                  );
                })}
              </CardContent>

              <div className="p-4 bg-slate-950/40 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearOption}
                  disabled={!currentAnswer?.selected_option}
                  className="text-slate-400 hover:text-rose-400 hover:bg-slate-800/40 text-xs"
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
                    className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs"
                  >
                    <ChevronLeft className="size-4 mr-1" />
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToQuestion(currentIndex + 1)}
                    disabled={currentIndex === questions.length - 1}
                    className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs"
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
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden">
            <CardHeader className="py-2.5 px-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ScanFace className="size-3.5 text-indigo-400" />
                AI Vision Proctor
              </span>
              <div className="flex items-center gap-2">
                {cameraBlocked ? (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5 flex items-center gap-1">
                    <VideoOff className="size-2.5" /> Disconnected
                  </Badge>
                ) : aiVisionResult?.status === "multiple_faces" ? (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5 flex items-center gap-1">
                    <Users className="size-2.5" /> Multi-Face
                  </Badge>
                ) : aiVisionResult?.status === "no_face" ? (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-rose-400 border-rose-500/30 bg-rose-500/10">
                    <UserX className="size-2.5 mr-0.5" /> No Face
                  </Badge>
                ) : aiVisionResult?.status === "head_turned" || aiVisionResult?.status === "looking_down" ? (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-amber-300 border-amber-500/30 bg-amber-500/10">
                    Look Forward
                  </Badge>
                ) : cameraActive && aiVisionResult?.status === "verified" ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    Verified
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">
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
                <div className="absolute inset-0 z-20 bg-slate-950/90 flex flex-col items-center justify-center p-3 text-center space-y-2">
                  <VideoOff className="size-6 text-rose-400 animate-pulse" />
                  <span className="text-xs font-semibold text-rose-200">Camera Feed Lost</span>
                  <span className="text-[10px] text-slate-400">Monitoring interrupted</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={initCameraAndVision}
                    className="text-xs h-7 border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                  >
                    <RefreshCw className="size-3 mr-1" /> Reconnect
                  </Button>
                </div>
              )}

              {/* Edge AI Vision HUD Overlays */}
              {cameraActive && aiVisionResult && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2">
                  {/* Top telemetry pills */}
                  <div className="flex items-center justify-between text-[9px] text-slate-200">
                    <span className="bg-slate-950/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-slate-800">
                      Faces: {aiVisionResult.faceCount}
                    </span>
                    <span className="bg-slate-950/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-slate-800 font-mono">
                      Y:{aiVisionResult.headPose.yawDeg}° P:{aiVisionResult.headPose.pitchDeg}°
                    </span>
                  </div>

                  {/* Centered bounding box guidance */}
                  <div className="flex items-center justify-center">
                    <div
                      className={`w-28 h-36 rounded-[40%] border border-dashed transition-colors ${
                        aiVisionResult.status === "multiple_faces"
                          ? "border-rose-500 bg-rose-500/10"
                          : aiVisionResult.status === "head_turned" || aiVisionResult.status === "looking_down"
                          ? "border-amber-400 bg-amber-500/10"
                          : aiVisionResult.status === "no_face"
                          ? "border-rose-400/50 bg-rose-500/5"
                          : "border-emerald-400/50"
                      }`}
                    />
                  </div>

                  {/* Bottom status message */}
                  <div className="text-center">
                    <span
                      className={`inline-block text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm ${
                        aiVisionResult.status === "multiple_faces"
                          ? "bg-rose-950/90 text-rose-300 border border-rose-500/40"
                          : aiVisionResult.status === "no_face"
                          ? "bg-rose-950/90 text-rose-300 border border-rose-500/40"
                          : aiVisionResult.status === "head_turned" || aiVisionResult.status === "looking_down"
                          ? "bg-amber-950/90 text-amber-300 border border-amber-500/40"
                          : "bg-slate-950/80 text-emerald-300 border border-slate-800"
                      }`}
                    >
                      {aiVisionResult.statusMessage}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Proctor Alert Audit Strip */}
            <div className="py-2 px-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-[10px]">
                <Shield className="size-3 text-indigo-400" />
                Edge AI Proctoring
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {proctorWarningsCount} Integrity Flags
              </span>
            </div>
          </Card>

          {/* 2. Question Navigation Grid */}
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
            <CardHeader className="py-3 px-4 border-b border-slate-800">
              <CardTitle className="text-xs font-semibold text-slate-200">
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

                    let bgClasses = "bg-slate-900 text-slate-400 border-slate-800";

                    if (isReview) {
                      bgClasses = "bg-amber-500 text-white border-amber-600";
                    } else if (isAnswered) {
                      bgClasses = "bg-emerald-600 text-white border-emerald-500";
                    } else if (isVisited) {
                      bgClasses = "bg-slate-700 text-slate-200 border-slate-600";
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToQuestion(idx)}
                        className={`size-9 rounded-lg font-bold text-xs flex items-center justify-center border transition-all ${bgClasses} ${
                          isCurrent
                            ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 scale-105"
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
              <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-emerald-600 shrink-0" />
                    <span>Answered ({answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-amber-500 shrink-0" />
                    <span>Review ({reviewCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-slate-700 shrink-0" />
                    <span>Unanswered ({unansweredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-slate-900 border border-slate-700 shrink-0" />
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
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-400" />
              Confirm Examination Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Are you sure you want to finalize your exam attempt? Once submitted, your answers cannot be altered.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 py-3 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Answered</span>
              <span className="text-sm font-bold text-emerald-400">{answeredCount}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Under Review</span>
              <span className="text-sm font-bold text-amber-400">{reviewCount}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Unanswered</span>
              <span className="text-sm font-bold text-slate-400">{unansweredCount}</span>
            </div>
          </div>

          {unansweredCount > 0 && (
            <p className="text-[11px] text-amber-300/80 bg-amber-500/10 p-2.5 rounded border border-amber-500/20">
              Notice: You have {unansweredCount} unanswered questions. Unanswered questions will receive 0 marks.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubmitDialog(false)}
              className="border-slate-700 bg-slate-800 text-slate-200"
            >
              Resume Test
            </Button>
            <Button
              size="sm"
              onClick={() => handleSubmitExam(false)}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
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
