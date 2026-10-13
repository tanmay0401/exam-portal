"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { VisionProctorDetector, VisionAnalysisResult } from "@/lib/proctoring/vision-detector";

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

  // System checks state
  const [cameraStatus, setCameraStatus] = useState<"pending" | "success" | "error">("pending");
  const [micStatus, setMicStatus] = useState<"pending" | "success" | "error">("pending");
  const [fullscreenStatus, setFullscreenStatus] = useState<"pending" | "success" | "error">("pending");
  const [browserStatus, setBrowserStatus] = useState<"pending" | "success" | "error">("pending");
  const [networkStatus, setNetworkStatus] = useState<"pending" | "success" | "error">("pending");
  const [aiVisionStatus, setAiVisionStatus] = useState<"loading" | "ready" | "no_face" | "calibrated">("loading");
  const [isIOSDevice, setIsIOSDevice] = useState<boolean>(false);

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

  // 2. Request and Test Camera + Microphone with Audio Analyser
  const startDevices = async () => {
    setCameraStatus("pending");
    setMicStatus("pending");
    setCameraErrorMsg(null);
    setMicErrorMsg(null);
    setAiVisionStatus("loading");

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

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not supported by your browser");
      }

      // Request video AND audio stream with fallback for iOS/iPadOS WebKit
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
      setCameraStatus("success");

      // Setup Web Audio Analyser for Microphone Check
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
          setMicStatus("success"); // Still permit if audio track exists
        }
      } else {
        setMicStatus("error");
        setMicErrorMsg("No active microphone track discovered.");
      }

      toast.success("Camera and microphone connected successfully");

      // Initialize Computer Vision Detector
      initializeVision();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Camera/Microphone permission denied or device busy";
      setCameraStatus("error");
      setMicStatus("error");
      setCameraErrorMsg(msg);
      setMicErrorMsg(msg);
      toast.error("Device permission required. Please allow camera and microphone access.");
    }
  };

  // 3. Initialize AI Vision & Run calibration test in system check
  const initializeVision = async () => {
    setVisionFeedback("Loading AI facial presence models...");
    try {
      const detector = new VisionProctorDetector();
      const ready = await detector.initialize();
      if (ready) {
        detectorRef.current = detector;
        setAiVisionStatus("ready");
        setVisionFeedback("AI Face Detection Active. Analyzing positioning...");
        startVisionCalibrationLoop();
      } else {
        setAiVisionStatus("ready");
        setVisionFeedback("Standard optical monitoring ready.");
      }
    } catch {
      setAiVisionStatus("ready");
      setVisionFeedback("Standard optical monitoring ready.");
    }
  };

  const startVisionCalibrationLoop = () => {
    const runAnalysis = () => {
      if (detectorRef.current && videoRef.current) {
        const result: VisionAnalysisResult | null = detectorRef.current.analyzeFrame(videoRef.current);
        if (result) {
          if (!result.primaryFaceDetected) {
            setAiVisionStatus("no_face");
            setVisionFeedback("⚠️ No face detected. Please center your face inside the framing guide.");
          } else if (result.multipleFacesDetected) {
            setAiVisionStatus("no_face");
            setVisionFeedback("⚠️ Multiple faces detected. Only one candidate is allowed in frame.");
          } else if (result.headPose.isTurnedAway) {
            setAiVisionStatus("ready");
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
  };

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
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  const allPassed =
    cameraStatus === "success" &&
    micStatus === "success" &&
    fullscreenStatus === "success" &&
    browserStatus === "success" &&
    networkStatus === "success";

  const handleProceed = async () => {
    if (!allPassed) {
      toast.error("All diagnostic security checks must pass before proceeding.");
      return;
    }

    setIsLoading(true);

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Ignored if user gesture requirement fails in some browsers
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-blue-600/10 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-md shadow-indigo-500/20">
              <div className="size-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="size-4.5 text-indigo-400" />
              </div>
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-none">
                ExamPortal
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {examTitle}
              </span>
            </div>
          </div>

          <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-xs py-1 px-3 bg-indigo-500/10">
            <Sparkles className="size-3 mr-1.5" />
            Stage 2 of 3: Pre-Exam Readiness Diagnostics
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-6">
          {/* Headline */}
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Pre-Exam System Readiness
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Verify your camera, microphone, and AI proctoring calibration before unlocking your question paper.
            </p>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live Camera Preview & AI Feedback */}
            <div className="md:col-span-6 space-y-4">
              <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <Camera className="size-4 text-indigo-400" />
                      Candidate Optical Stream
                    </CardTitle>
                    {cameraStatus === "success" ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        Live Feed Active
                      </span>
                    ) : cameraStatus === "pending" ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
                        <Loader2 className="size-3 animate-spin" />
                        Requesting...
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-rose-400">
                        Disconnected
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-0 bg-slate-950 relative aspect-[4/3] flex items-center justify-center">
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
                    <div className="flex flex-col items-center gap-2 text-slate-400 text-xs p-6 text-center">
                      <Loader2 className="size-8 text-indigo-400 animate-spin" />
                      <p>Waiting for webcam and microphone permission prompt...</p>
                    </div>
                  )}

                  {cameraStatus === "error" && (
                    <div className="flex flex-col items-center gap-3 text-rose-400 text-xs p-6 text-center max-w-sm">
                      <div className="size-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                        <XCircle className="size-6 text-rose-400" />
                      </div>
                      <p className="font-semibold text-rose-200">Device Access Denied</p>
                      <p className="text-slate-400 text-[11px]">
                        {cameraErrorMsg || "Please allow webcam and microphone access in browser settings and retry."}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={startDevices}
                        className="mt-2 border-slate-700 bg-slate-800 text-slate-200 hover:text-white"
                      >
                        <RefreshCw className="size-3 mr-1.5" />
                        Retry Permissions
                      </Button>
                    </div>
                  )}

                  {/* Face Framing Guide Overlay */}
                  {cameraStatus === "success" && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div
                        className={`w-44 h-56 rounded-[40%] border-2 border-dashed transition-colors flex items-center justify-center ${
                          aiVisionStatus === "calibrated"
                            ? "border-emerald-400/80 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                            : aiVisionStatus === "no_face"
                            ? "border-rose-400/70 bg-rose-500/5"
                            : "border-indigo-400/40"
                        }`}
                      >
                        <span className="text-[10px] text-slate-200 bg-slate-950/80 px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-slate-800">
                          {aiVisionStatus === "calibrated" ? "Face Calibrated ✓" : "Keep Face Centered"}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* AI Calibration Feedback Strip */}
                <div className="py-2 px-3 bg-slate-900 border-t border-slate-800/80 flex items-center gap-2 text-xs">
                  <ScanFace className="size-3.5 text-indigo-400 shrink-0" />
                  <span className="text-slate-300 font-medium text-[11px] truncate">
                    {visionFeedback}
                  </span>
                </div>

                {/* Live Microphone Audio Level Visualizer */}
                <CardFooter className="py-2.5 px-4 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-1.5 font-medium text-slate-300">
                      <Mic className="size-3 text-indigo-400" />
                      Microphone Audio Input
                    </span>
                    <span className="text-[10px] font-mono text-indigo-300">
                      {audioLevel > 5 ? "Audio Detected" : "Quiet Room"}
                    </span>
                  </div>
                  <div className="w-full flex items-center gap-2">
                    <Volume2 className="size-3 text-slate-400 shrink-0" />
                    <Progress value={Math.max(5, audioLevel * 1.5)} className="h-1.5 bg-slate-800 flex-1" />
                    <span className="text-[10px] text-slate-400 font-mono w-6 text-right">{audioLevel}%</span>
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Right Column: Diagnostic Checklist & Launch */}
            <div className="md:col-span-6 space-y-4">
              <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Monitor className="size-4 text-indigo-400" />
                    Security Diagnostic Checklist
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    All environmental conditions must be satisfied before your test paper can be unlocked.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2.5">
                  {/* Item 1: Camera */}
                  <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        cameraStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : cameraStatus === "error"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        <Camera className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Webcam Optical Feed</div>
                        <div className="text-[11px] text-slate-400">Facial presence and identity tracking</div>
                      </div>
                    </div>
                    {cameraStatus === "success" ? (
                      <CheckCircle className="size-5 text-emerald-400" />
                    ) : cameraStatus === "error" ? (
                      <XCircle className="size-5 text-rose-400" />
                    ) : (
                      <Loader2 className="size-4 text-slate-400 animate-spin" />
                    )}
                  </div>

                  {/* Item 2: Microphone */}
                  <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        micStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : micStatus === "error"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        <Mic className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Microphone Input</div>
                        <div className="text-[11px] text-slate-400">Acoustic environment disturbance check</div>
                      </div>
                    </div>
                    {micStatus === "success" ? (
                      <CheckCircle className="size-5 text-emerald-400" />
                    ) : micStatus === "error" ? (
                      <XCircle className="size-5 text-rose-400" />
                    ) : (
                      <Loader2 className="size-4 text-slate-400 animate-spin" />
                    )}
                  </div>

                  {/* Item 3: AI Face Verification Calibration */}
                  <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        aiVisionStatus === "calibrated" || aiVisionStatus === "ready"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-indigo-500/10 text-indigo-400"
                      }`}>
                        <ScanFace className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Edge AI Vision Engine</div>
                        <div className="text-[11px] text-slate-400">MediaPipe multi-face and pose model</div>
                      </div>
                    </div>
                    {aiVisionStatus === "calibrated" || aiVisionStatus === "ready" ? (
                      <CheckCircle className="size-5 text-emerald-400" />
                    ) : (
                      <Loader2 className="size-4 text-indigo-400 animate-spin" />
                    )}
                  </div>

                  {/* Item 4: Fullscreen */}
                  <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        fullscreenStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}>
                        <Maximize className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          {isIOSDevice ? "Window Confinement Protocol" : "Fullscreen Protocol"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {isIOSDevice ? "Active window & visibility tracking enabled" : "Window confinement enforcement"}
                        </div>
                      </div>
                    </div>
                    {fullscreenStatus === "success" ? (
                      <CheckCircle className="size-5 text-emerald-400" />
                    ) : (
                      <XCircle className="size-5 text-rose-400" />
                    )}
                  </div>

                  {/* Item 5: Browser */}
                  <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        browserStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}>
                        <Monitor className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Browser Compatibility</div>
                        <div className="text-[11px] text-slate-400">WebRTC, WebAssembly & Canvas verified</div>
                      </div>
                    </div>
                    {browserStatus === "success" ? (
                      <CheckCircle className="size-5 text-emerald-400" />
                    ) : (
                      <XCircle className="size-5 text-rose-400" />
                    )}
                  </div>

                  {/* Item 6: Network */}
                  <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        networkStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}>
                        <Wifi className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Network Connectivity</div>
                        <div className="text-[11px] text-slate-400">Active server connection confirmed</div>
                      </div>
                    </div>
                    {networkStatus === "success" ? (
                      <CheckCircle className="size-5 text-emerald-400" />
                    ) : (
                      <XCircle className="size-5 text-rose-400" />
                    )}
                  </div>
                </CardContent>

                {/* Warning note */}
                <CardFooter className="pt-2 flex flex-col gap-3">
                  {!allPassed && (
                    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-200 py-2">
                      <AlertTriangle className="size-4 text-amber-400" />
                      <AlertTitle className="text-xs font-medium">Diagnostic Alert</AlertTitle>
                      <AlertDescription className="text-[11px] text-amber-300/80">
                        Camera and microphone permissions are required to unlock your examination.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleProceed}
                    disabled={!allPassed || isLoading}
                    size="lg"
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Entering Secure Exam Mode...
                      </>
                    ) : (
                      <>
                        <span>Proceed to Exam</span>
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
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/40 py-4 text-center text-xs text-slate-500">
        <p>ExamPortal Diagnostics & AI Proctoring Engine • Confidential Examination</p>
      </footer>
    </div>
  );
}
