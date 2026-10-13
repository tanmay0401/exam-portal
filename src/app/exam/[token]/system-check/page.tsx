"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Camera,
  Mic,
  Monitor,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Maximize,
  RefreshCw,
  ArrowRight,
  Wifi,
  Sparkles,
  Volume2,
  ScanFace,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  VisionProctorDetector,
  VisionAnalysisResult,
  isBlackOrEmptyFrame,
} from "@/lib/proctoring/vision-detector";

export default function SystemCheckPage() {
  const routeParams = useParams();
  const token = (routeParams?.token as string) || "";
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<VisionProctorDetector | null>(null);
  const visionLoopRef = useRef<number | null>(null);
  const calibrationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // System checks state
  const [cameraStatus, setCameraStatus] = useState<"pending" | "success" | "error">("pending");
  const [micStatus, setMicStatus] = useState<"pending" | "success" | "error">("pending");
  const [fullscreenStatus, setFullscreenStatus] = useState<"pending" | "success" | "error">("pending");
  const [browserStatus, setBrowserStatus] = useState<"pending" | "success" | "error">("pending");
  const [networkStatus, setNetworkStatus] = useState<"pending" | "success" | "error">("pending");
  const [aiVisionStatus, setAiVisionStatus] = useState<"loading" | "ready" | "no_face" | "calibrated" | "error">("loading");
  const [isIOSDevice, setIsIOSDevice] = useState<boolean>(false);
  const [calibrationTimeoutReached, setCalibrationTimeoutReached] = useState<boolean>(false);

  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [micErrorMsg, setMicErrorMsg] = useState<string | null>(null);
  const [visionFeedback, setVisionFeedback] = useState<string>("Initializing computer vision models...");
  const [examTitle, setExamTitle] = useState<string>("Online Examination");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch exam title for header context
  useEffect(() => {
    fetch(`/api/exam-link/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.exam?.title) {
          setExamTitle(data.exam.title);
        }
      })
      .catch(() => {});
  }, [token]);

  // 1. Check Browser, Fullscreen & Network Capabilities
  useEffect(() => {
    const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    const hasStorage = typeof window !== "undefined" && !!window.localStorage;
    const hasFetch = typeof window !== "undefined" && !!window.fetch;

    if (hasMedia && hasStorage && hasFetch) {
      setBrowserStatus("success");
    } else {
      setBrowserStatus("error");
    }

    const isIOSorIPad =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setIsIOSDevice(isIOSorIPad);

    const fsEnabled =
      typeof document !== "undefined" &&
      (document.fullscreenEnabled ||
        (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled ||
        false);

    if (fsEnabled || isIOSorIPad) {
      setFullscreenStatus("success");
    } else {
      setFullscreenStatus("error");
    }

    if (typeof navigator !== "undefined" && navigator.onLine) {
      setNetworkStatus("success");
    } else {
      setNetworkStatus("error");
    }
  }, []);

  const startVisionCalibrationLoop = useCallback(() => {
    const runAnalysis = () => {
      if (detectorRef.current && videoRef.current) {
        // Fail-closed check: verify camera is not black or obscured
        if (isBlackOrEmptyFrame(videoRef.current)) {
          setCameraStatus("error");
          setCameraErrorMsg("Camera video stream is black or covered. Ensure your camera lens is uncovered.");
          setAiVisionStatus("no_face");
          setVisionFeedback("⚠️ Camera feed is completely black. Cannot perform face verification.");
          visionLoopRef.current = window.setTimeout(runAnalysis, 800);
          return;
        }

        const result: VisionAnalysisResult | null = detectorRef.current.analyzeFrame(videoRef.current);
        if (result) {
          if (!result.primaryFaceDetected) {
            setAiVisionStatus("no_face");
            setVisionFeedback("⚠️ No face detected. Please center your face inside the framing guide.");
          } else if (result.multipleFacesDetected) {
            setAiVisionStatus("no_face");
            setVisionFeedback("⚠️ Multiple faces detected. Only one candidate is allowed in frame.");
          } else if (result.headPose.isTurnedAway) {
            setAiVisionStatus("no_face");
            setVisionFeedback("⚠️ Head turned away. Please look directly toward the screen.");
          } else {
            setAiVisionStatus("calibrated");
            setVisionFeedback("✅ Face verified and calibrated. Positioning is optimal!");
          }
        }
      }
      visionLoopRef.current = window.setTimeout(runAnalysis, 400);
    };

    runAnalysis();
  }, []);

  // 3. Initialize AI Vision & Run calibration test in system check
  const initializeVision = useCallback(async () => {
    setVisionFeedback("Loading AI facial presence models...");
    setAiVisionStatus("loading");
    try {
      const detector = new VisionProctorDetector();
      const ready = await detector.initialize();
      if (ready) {
        detectorRef.current = detector;
        setAiVisionStatus("ready");
        setVisionFeedback("AI Face Detection Active. Analyzing positioning...");
        startVisionCalibrationLoop();
      } else {
        // Fail closed: mandatory proctoring cannot proceed without AI model
        setAiVisionStatus("error");
        setVisionFeedback("❌ Failed to initialize AI vision engine. Proctoring model could not load.");
        toast.error("Proctoring initialization failed. Mandatory monitoring requires MediaPipe.");
      }
    } catch (e) {
      console.error("Vision init failure:", e);
      setAiVisionStatus("error");
      setVisionFeedback("❌ Error loading AI proctoring model. Please check connection and WebAssembly support.");
      toast.error("Proctoring initialization error. Cannot proceed without monitoring.");
    }
  }, [startVisionCalibrationLoop]);

  // 2. Request and Test Camera + Microphone with Audio Analyser
  const startDevices = useCallback(async () => {
    setCameraStatus("pending");
    setMicStatus("pending");
    setCameraErrorMsg(null);
    setMicErrorMsg(null);
    setAiVisionStatus("loading");
    setCalibrationTimeoutReached(false);

    // Clean up any existing streams
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (visionLoopRef.current) {
      clearTimeout(visionLoopRef.current);
    }
    if (calibrationTimerRef.current) {
      clearTimeout(calibrationTimerRef.current);
    }

    // Set 20 second calibration timeout
    calibrationTimerRef.current = setTimeout(() => {
      setCalibrationTimeoutReached(true);
    }, 20000);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not supported by your browser");
      }

      // Request video AND audio stream
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (combinedErr) {
        // Fallback: If combined request failed, request video first
        console.warn("Combined media request notice, falling back to separate tracks:", combinedErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
        });
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioOnlyStream.getAudioTracks().forEach((track) => stream.addTrack(track));
        } catch (audioErr) {
          console.warn("Optional audio track not available:", audioErr);
        }
      }

      streamRef.current = stream;

      // Setup Video
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Check if video is producing real frames or black feed after settling
      setTimeout(() => {
        if (videoRef.current && isBlackOrEmptyFrame(videoRef.current)) {
          setCameraStatus("error");
          setCameraErrorMsg("Camera feed is black or obscured. Please uncover your webcam, verify lighting, and ensure no other application is using it.");
          setAiVisionStatus("error");
          setVisionFeedback("Camera stream is pitch black. Uncover camera lens to proceed.");
          toast.error("Camera feed is black or obscured. Please check your camera.");
        } else {
          setCameraStatus("success");
          initializeVision();
        }
      }, 700);

      // Setup Web Audio Analyser for Microphone Check
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        try {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          if (audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
          }

          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateAudioLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const level = Math.min(100, Math.round((average / 128) * 100));
            setAudioLevel(level);
            animFrameRef.current = requestAnimationFrame(updateAudioLevel);
          };

          updateAudioLevel();
          setMicStatus("success");
        } catch {
          setMicStatus("success");
        }
      } else {
        setMicStatus("error");
        setMicErrorMsg("No active microphone track discovered.");
      }

      toast.success("Camera and audio hardware detected");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Camera/Microphone permission denied or device busy";
      setCameraStatus("error");
      setMicStatus("error");
      setCameraErrorMsg(msg);
      setMicErrorMsg(msg);
      setAiVisionStatus("error");
      setVisionFeedback("Cannot initialize proctoring without camera access.");
      toast.error("Device permission required. Please allow camera and microphone access.");
    }
  }, [initializeVision]);

  useEffect(() => {
    startDevices();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (visionLoopRef.current) {
        clearTimeout(visionLoopRef.current);
      }
      if (calibrationTimerRef.current) {
        clearTimeout(calibrationTimerRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, [startDevices]);

  // Strict Fail-Closed Rule: all diagnostics AND face calibration must pass
  const allPassed =
    cameraStatus === "success" &&
    micStatus === "success" &&
    fullscreenStatus === "success" &&
    browserStatus === "success" &&
    networkStatus === "success" &&
    aiVisionStatus === "calibrated";

  const handleProceed = async () => {
    if (!allPassed) {
      toast.error("All mandatory checks including face calibration must pass before starting.");
      return;
    }

    setIsLoading(true);

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Handled gracefully for iOS / iPadOS
    }

    // Stop streams before navigation so attempt page can cleanly acquire it
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    if (detectorRef.current) {
      detectorRef.current.dispose();
    }

    router.push(`/exam/${token}/attempt`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Top Header */}
      <header className="border-b border-[#D2D2D7]/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#0071E3] text-white flex items-center justify-center shadow-sm">
              <Shield className="size-5" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-[#1D1D1F] block leading-none">
                ExamPortal
              </span>
              <span className="text-[11px] text-[#6E6E73] block mt-0.5 font-medium truncate max-w-[200px] sm:max-w-md">
                {examTitle}
              </span>
            </div>
          </div>

          <Badge variant="outline" className="border-[#D2D2D7] text-[#1D1D1F] text-xs py-1 px-3 bg-white shadow-sm font-medium">
            <Sparkles className="size-3 mr-1.5 text-[#0071E3]" />
            Stage 2 of 3: Pre-Exam Readiness Diagnostics
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-6">
          {/* Headline */}
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1D1D1F] tracking-tight">
              Pre-Exam System Readiness
            </h1>
            <p className="text-xs sm:text-sm text-[#6E6E73]">
              Verify your camera, microphone, and AI proctoring calibration before unlocking your question paper.
            </p>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live Camera Preview & AI Feedback */}
            <div className="md:col-span-6 space-y-4">
              <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-[#D2D2D7]/80 bg-[#F5F5F7]/40">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-[#1D1D1F] flex items-center gap-2">
                      <Camera className="size-4 text-[#0071E3]" />
                      Candidate Optical Stream
                    </CardTitle>
                    {cameraStatus === "success" ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1E7E34]">
                        <span className="size-2 rounded-full bg-[#34C759] animate-pulse" />
                        Live Feed Active
                      </span>
                    ) : cameraStatus === "pending" ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#B25E00]">
                        <Loader2 className="size-3 animate-spin text-[#FF9500]" />
                        Requesting...
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#D70015]">
                        Camera Unavailable
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-0 bg-black relative aspect-[4/3] flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`size-full object-cover transform -scale-x-100 ${
                      cameraStatus === "success" ? "block" : "hidden"
                    }`}
                  />

                  {cameraStatus === "pending" && (
                    <div className="flex flex-col items-center gap-2 text-[#86868B] text-xs p-6 text-center">
                      <Loader2 className="size-8 text-[#0071E3] animate-spin" />
                      <p>Waiting for webcam and microphone permission prompt...</p>
                    </div>
                  )}

                  {cameraStatus === "error" && (
                    <div className="flex flex-col items-center gap-3 text-[#D70015] text-xs p-6 text-center max-w-sm">
                      <div className="size-10 rounded-full bg-[#FF3B30]/10 flex items-center justify-center">
                        <XCircle className="size-6 text-[#FF3B30]" />
                      </div>
                      <p className="font-semibold text-[#1D1D1F]">Camera Feed Blocked or Inactive</p>
                      <p className="text-[#6E6E73] text-[11px]">
                        {cameraErrorMsg || "Please allow webcam and microphone access in browser settings and uncover camera lens."}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={startDevices}
                        className="mt-2 border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] font-medium text-xs"
                      >
                        <RefreshCw className="size-3 mr-1.5 text-[#0071E3]" />
                        Retry Permissions
                      </Button>
                    </div>
                  )}

                  {/* Face Framing Guide Overlay */}
                  {cameraStatus === "success" && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div
                        className={`w-44 h-56 rounded-[40%] border-2 border-dashed transition-all flex items-center justify-center ${
                          aiVisionStatus === "calibrated"
                            ? "border-[#34C759] bg-[#34C759]/10 shadow-[0_0_20px_rgba(52,199,89,0.3)]"
                            : aiVisionStatus === "no_face"
                            ? "border-[#FF3B30] bg-[#FF3B30]/10"
                            : "border-[#0071E3]/70"
                        }`}
                      >
                        <span className="text-[10px] font-semibold text-[#1D1D1F] bg-white/90 px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-[#D2D2D7] shadow-sm">
                          {aiVisionStatus === "calibrated" ? "Face Calibrated ✓" : "Keep Face Centered"}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* AI Calibration Feedback Strip */}
                <div className="py-2.5 px-4 bg-[#F5F5F7] border-t border-[#D2D2D7] flex items-center gap-2 text-xs">
                  <ScanFace className="size-3.5 text-[#0071E3] shrink-0" />
                  <span className="text-[#1D1D1F] font-medium text-[11px] truncate">
                    {visionFeedback}
                  </span>
                </div>

                {/* Live Microphone Audio Level Visualizer */}
                <CardFooter className="py-2.5 px-4 bg-white border-t border-[#D2D2D7] text-[11px] text-[#6E6E73] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-1.5 font-medium text-[#1D1D1F]">
                      <Mic className="size-3 text-[#0071E3]" />
                      Microphone Audio Input
                    </span>
                    <span className="text-[10px] font-mono text-[#6E6E73]">
                      {audioLevel > 5 ? "Audio Detected" : "Quiet Room"}
                    </span>
                  </div>
                  <div className="w-full flex items-center gap-2">
                    <Volume2 className="size-3 text-[#6E6E73] shrink-0" />
                    <Progress value={Math.max(5, audioLevel * 1.5)} className="h-1.5 bg-[#E8E8ED] flex-1" />
                    <span className="text-[10px] text-[#6E6E73] font-mono w-6 text-right">{audioLevel}%</span>
                  </div>
                </CardFooter>
              </Card>

              {/* Troubleshooting Card if calibration times out */}
              {calibrationTimeoutReached && aiVisionStatus !== "calibrated" && (
                <Card className="border-[#FF9500]/30 bg-[#FF9500]/10 text-xs p-4 space-y-2 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 font-semibold text-[#B25E00]">
                    <HelpCircle className="size-4 text-[#FF9500]" />
                    <span>Face Verification Troubleshooting</span>
                  </div>
                  <ul className="text-[#424245] text-[11px] space-y-1 list-disc list-inside">
                    <li>Ensure you are in a well-lit environment facing a light source.</li>
                    <li>Uncover your camera lens and remove physical shutters.</li>
                    <li>Position your face directly in the center oval of the preview.</li>
                    <li>Ensure no secondary persons are visible behind you.</li>
                  </ul>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startDevices}
                    className="w-full mt-2 border-[#FF9500]/40 bg-white text-[#B25E00] hover:bg-[#FF9500]/15 text-xs font-medium"
                  >
                    <RefreshCw className="size-3 mr-1.5 text-[#FF9500]" />
                    Re-Test Camera & AI Calibration
                  </Button>
                </Card>
              )}
            </div>

            {/* Right Column: Diagnostic Checklist & Launch */}
            <div className="md:col-span-6 space-y-4">
              <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-[#D2D2D7]/80 bg-[#F5F5F7]/40">
                  <CardTitle className="text-base text-[#1D1D1F] font-bold flex items-center gap-2">
                    <Monitor className="size-4 text-[#0071E3]" />
                    Security Diagnostic Checklist
                  </CardTitle>
                  <CardDescription className="text-[#6E6E73] text-xs">
                    All environmental conditions must be satisfied before your test paper can be unlocked.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2.5 pt-4">
                  {/* Item 1: Camera */}
                  <div className="p-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        cameraStatus === "success"
                          ? "bg-[#34C759]/15 text-[#1E7E34]"
                          : cameraStatus === "error"
                          ? "bg-[#FF3B30]/15 text-[#D70015]"
                          : "bg-[#E8E8ED] text-[#6E6E73]"
                      }`}>
                        <Camera className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Webcam Optical Feed</div>
                        <div className="text-[11px] text-[#6E6E73]">Active video track & non-black stream</div>
                      </div>
                    </div>
                    {cameraStatus === "success" ? (
                      <CheckCircle className="size-5 text-[#34C759]" />
                    ) : cameraStatus === "error" ? (
                      <XCircle className="size-5 text-[#FF3B30]" />
                    ) : (
                      <Loader2 className="size-4 text-[#0071E3] animate-spin" />
                    )}
                  </div>

                  {/* Item 2: Microphone */}
                  <div className="p-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        micStatus === "success"
                          ? "bg-[#34C759]/15 text-[#1E7E34]"
                          : micStatus === "error"
                          ? "bg-[#FF3B30]/15 text-[#D70015]"
                          : "bg-[#E8E8ED] text-[#6E6E73]"
                      }`}>
                        <Mic className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Microphone Input</div>
                        <div className="text-[11px] text-[#6E6E73]">Acoustic environment disturbance check</div>
                      </div>
                    </div>
                    {micStatus === "success" ? (
                      <CheckCircle className="size-5 text-[#34C759]" />
                    ) : micStatus === "error" ? (
                      <XCircle className="size-5 text-[#FF3B30]" />
                    ) : (
                      <Loader2 className="size-4 text-[#0071E3] animate-spin" />
                    )}
                  </div>

                  {/* Item 3: AI Face Verification Calibration */}
                  <div className="p-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        aiVisionStatus === "calibrated"
                          ? "bg-[#34C759]/15 text-[#1E7E34]"
                          : aiVisionStatus === "error"
                          ? "bg-[#FF3B30]/15 text-[#D70015]"
                          : "bg-[#0071E3]/15 text-[#0071E3]"
                      }`}>
                        <ScanFace className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Edge AI Face Calibration</div>
                        <div className="text-[11px] text-[#6E6E73]">
                          {aiVisionStatus === "calibrated"
                            ? "Face presence & head pose verified"
                            : aiVisionStatus === "error"
                            ? "MediaPipe engine failed to load"
                            : "Waiting for face alignment in frame"}
                        </div>
                      </div>
                    </div>
                    {aiVisionStatus === "calibrated" ? (
                      <CheckCircle className="size-5 text-[#34C759]" />
                    ) : aiVisionStatus === "error" ? (
                      <XCircle className="size-5 text-[#FF3B30]" />
                    ) : (
                      <Loader2 className="size-4 text-[#0071E3] animate-spin" />
                    )}
                  </div>

                  {/* Item 4: Fullscreen */}
                  <div className="p-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        fullscreenStatus === "success"
                          ? "bg-[#34C759]/15 text-[#1E7E34]"
                          : "bg-[#FF3B30]/15 text-[#D70015]"
                      }`}>
                        <Maximize className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">
                          {isIOSDevice ? "Window Confinement Protocol" : "Fullscreen Protocol"}
                        </div>
                        <div className="text-[11px] text-[#6E6E73]">
                          {isIOSDevice ? "Active window & visibility tracking enabled" : "Window confinement enforcement"}
                        </div>
                      </div>
                    </div>
                    {fullscreenStatus === "success" ? (
                      <CheckCircle className="size-5 text-[#34C759]" />
                    ) : (
                      <XCircle className="size-5 text-[#FF3B30]" />
                    )}
                  </div>

                  {/* Item 5: Browser */}
                  <div className="p-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        browserStatus === "success"
                          ? "bg-[#34C759]/15 text-[#1E7E34]"
                          : "bg-[#FF3B30]/15 text-[#D70015]"
                      }`}>
                        <Monitor className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Browser Compatibility</div>
                        <div className="text-[11px] text-[#6E6E73]">WebRTC, WebAssembly & Canvas verified</div>
                      </div>
                    </div>
                    {browserStatus === "success" ? (
                      <CheckCircle className="size-5 text-[#34C759]" />
                    ) : (
                      <XCircle className="size-5 text-[#FF3B30]" />
                    )}
                  </div>

                  {/* Item 6: Network */}
                  <div className="p-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        networkStatus === "success"
                          ? "bg-[#34C759]/15 text-[#1E7E34]"
                          : "bg-[#FF3B30]/15 text-[#D70015]"
                      }`}>
                        <Wifi className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Network Connectivity</div>
                        <div className="text-[11px] text-[#6E6E73]">Active server connection confirmed</div>
                      </div>
                    </div>
                    {networkStatus === "success" ? (
                      <CheckCircle className="size-5 text-[#34C759]" />
                    ) : (
                      <XCircle className="size-5 text-[#FF3B30]" />
                    )}
                  </div>
                </CardContent>

                {/* Status Guidance / Action */}
                <CardFooter className="pt-2 pb-6 px-6 flex flex-col gap-3">
                  {!allPassed && (
                    <Alert className="border-[#FF9500]/30 bg-[#FF9500]/10 text-[#B25E00] py-2 rounded-xl">
                      <AlertTriangle className="size-4 text-[#FF9500]" />
                      <AlertTitle className="text-xs font-medium">Mandatory Verification Required</AlertTitle>
                      <AlertDescription className="text-[11px] text-[#B25E00] mt-0.5">
                        {cameraStatus !== "success"
                          ? "Camera access must be granted and produce a clear video feed."
                          : aiVisionStatus !== "calibrated"
                          ? "Center your face in the oval guide until calibration is verified."
                          : "All security checks must pass before starting the assessment."}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleProceed}
                    disabled={!allPassed || isLoading}
                    size="lg"
                    className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl h-11 shadow-sm transition-all disabled:opacity-50 disabled:bg-[#D2D2D7] disabled:text-[#86868B]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Entering Secure Exam Mode...
                      </>
                    ) : (
                      <>
                        <span>{allPassed ? "Start Exam Now" : "Complete Verification to Start"}</span>
                        <ArrowRight className="size-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D2D2D7]/80 bg-white py-4 text-center text-xs text-[#86868B]">
        <p>ExamPortal Diagnostics & AI Proctoring Engine • Confidential Examination</p>
      </footer>
    </div>
  );
}
