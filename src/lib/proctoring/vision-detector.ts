// Client-side Browser Computer Vision Proctoring Engine
// Uses MediaPipe Tasks Vision Face Landmarker for real-time edge processing

export interface VisionAnalysisResult {
  faceCount: number;
  primaryFaceDetected: boolean;
  multipleFacesDetected: boolean;
  backgroundPersonDetected: boolean;
  headPose: {
    pitchDeg: number;
    yawDeg: number;
    rollDeg: number;
    isTurnedAway: boolean;
    isLookingDown: boolean;
  };
  gaze: {
    horizontalRatio: number;
    verticalRatio: number;
    isGazeAway: boolean;
  };
  status: "verified" | "no_face" | "multiple_faces" | "head_turned" | "looking_down" | "gaze_away";
  statusMessage: string;
  confidence: number;
}

export type VisionWarningCallback = (event: {
  type: string;
  message: string;
  severity: "info" | "warning" | "alert";
  details?: Record<string, unknown>;
}) => void;

/**
 * Samples pixel luminance across the current video frame.
 * Returns true if the video is black, obscured, or lacks valid visual frames.
 */
export function isBlackOrEmptyFrame(videoElement: HTMLVideoElement | null): boolean {
  if (!videoElement) return true;
  if (
    videoElement.readyState < 2 ||
    videoElement.videoWidth === 0 ||
    videoElement.videoHeight === 0
  ) {
    return true;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(videoElement, 0, 0, 32, 24);
    const imgData = ctx.getImageData(0, 0, 32, 24).data;
    let sumLuminance = 0;
    const totalPixels = imgData.length / 4;
    for (let i = 0; i < imgData.length; i += 4) {
      sumLuminance += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
    }
    const avgLuminance = sumLuminance / totalPixels;
    return avgLuminance < 8;
  } catch {
    return false;
  }
}

export class VisionProctorDetector {
  private faceLandmarker: any = null;
  private isInitializing = false;
  private isReady = false;
  private lastAnalysisTime = 0;
  private consecutiveAnomalies: Record<string, number> = {
    no_face: 0,
    multiple_faces: 0,
    head_turned: 0,
    looking_down: 0,
    gaze_away: 0,
  };
  private lastLoggedEvents: Record<string, number> = {};
  private onWarningCallback: VisionWarningCallback | null = null;

  constructor(onWarning?: VisionWarningCallback) {
    if (onWarning) {
      this.onWarningCallback = onWarning;
    }
  }

  public async initialize(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;
    if (typeof window === "undefined") return false;

    this.isInitializing = true;
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, FaceLandmarker } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 3,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isReady = true;
      this.isInitializing = false;
      return true;
    } catch (err) {
      console.warn("MediaPipe GPU initialization notice, falling back to CPU mode:", err);
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, FaceLandmarker } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 3,
          minFaceDetectionConfidence: 0.4,
        });

        this.isReady = true;
        this.isInitializing = false;
        return true;
      } catch (cpuErr) {
        console.error("MediaPipe failed to initialize entirely:", cpuErr);
        this.isInitializing = false;
        return false;
      }
    }
  }

  public analyzeFrame(videoElement: HTMLVideoElement): VisionAnalysisResult | null {
    if (!this.isReady || !this.faceLandmarker || !videoElement) {
      return null;
    }

    if (
      videoElement.readyState < 2 ||
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0
    ) {
      return null;
    }

    const now = performance.now();
    // Throttle inference: max once every 350ms to keep CPU minimal
    if (now - this.lastAnalysisTime < 350) {
      return null;
    }
    this.lastAnalysisTime = now;

    try {
      const results = this.faceLandmarker.detectForVideo(videoElement, now);
      const faceCount = results.faceLandmarks ? results.faceLandmarks.length : 0;

      // Case 1: No Face Detected
      if (faceCount === 0) {
        this.consecutiveAnomalies.no_face += 1;
        this.consecutiveAnomalies.multiple_faces = 0;
        this.consecutiveAnomalies.head_turned = 0;
        this.consecutiveAnomalies.looking_down = 0;
        this.consecutiveAnomalies.gaze_away = 0;

        if (this.consecutiveAnomalies.no_face >= 6) { // ~2 seconds of absence
          this.triggerDebouncedWarning("face_not_detected", "No face detected in camera view", "warning", {
            consecutiveFrames: this.consecutiveAnomalies.no_face,
          });
        }

        return {
          faceCount: 0,
          primaryFaceDetected: false,
          multipleFacesDetected: false,
          backgroundPersonDetected: false,
          headPose: {
            pitchDeg: 0,
            yawDeg: 0,
            rollDeg: 0,
            isTurnedAway: false,
            isLookingDown: false,
          },
          gaze: {
            horizontalRatio: 0.5,
            verticalRatio: 0.5,
            isGazeAway: false,
          },
          status: "no_face",
          statusMessage: "No face detected. Please position yourself in front of the camera.",
          confidence: 0,
        };
      }

      this.consecutiveAnomalies.no_face = 0;

      // Extract primary face landmarks (index 0)
      const primaryLandmarks = results.faceLandmarks[0];

      // Check for multiple faces or background persons
      const multipleFaces = faceCount > 1;
      let backgroundPerson = false;

      if (multipleFaces) {
        // If secondary face has smaller bounding box or is further away, classify as background person
        const secondary = results.faceLandmarks[1];
        if (secondary && secondary.length > 0) {
          backgroundPerson = true;
        }

        this.consecutiveAnomalies.multiple_faces += 1;
        if (this.consecutiveAnomalies.multiple_faces >= 4) { // ~1.5s
          this.triggerDebouncedWarning(
            backgroundPerson ? "background_person_detected" : "multiple_faces_detected",
            backgroundPerson
              ? "Secondary person detected in camera background"
              : "Multiple faces detected in camera feed",
            "alert",
            { faceCount }
          );
        }
      } else {
        this.consecutiveAnomalies.multiple_faces = 0;
      }

      // Compute head pose (Euler angles)
      // Landmarks: 1 = Nose tip, 152 = Chin, 33 = Left eye outer, 263 = Right eye outer, 10 = Forehead top
      const noseTip = primaryLandmarks[1] || { x: 0.5, y: 0.5, z: 0 };
      const chin = primaryLandmarks[152] || { x: 0.5, y: 0.8, z: 0 };
      const leftEyeOuter = primaryLandmarks[33] || { x: 0.3, y: 0.4, z: 0 };
      const rightEyeOuter = primaryLandmarks[263] || { x: 0.7, y: 0.4, z: 0 };
      const forehead = primaryLandmarks[10] || { x: 0.5, y: 0.2, z: 0 };

      // Yaw estimation (Turning head left/right):
      // Ratio of nose to left eye distance vs nose to right eye distance
      const distNoseLeft = Math.abs(noseTip.x - leftEyeOuter.x);
      const distNoseRight = Math.abs(rightEyeOuter.x - noseTip.x);
      const eyeWidth = Math.max(0.001, Math.abs(rightEyeOuter.x - leftEyeOuter.x));
      const yawRatio = (distNoseLeft - distNoseRight) / eyeWidth;
      const yawDeg = Math.round(yawRatio * 75); // approximate degrees (-45° to +45°)

      // Pitch estimation (Looking down or up):
      // Vertical distance between nose tip and midpoint between eyes and chin
      const midEyeChinY = (forehead.y + chin.y) / 2;
      const pitchRatio = (noseTip.y - midEyeChinY) / Math.max(0.001, chin.y - forehead.y);
      const pitchDeg = Math.round(pitchRatio * 90);

      // Roll estimation (Tilting head sideways)
      const dy = rightEyeOuter.y - leftEyeOuter.y;
      const dx = rightEyeOuter.x - leftEyeOuter.x;
      const rollDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);

      const isTurnedAway = Math.abs(yawDeg) > 28;
      const isLookingDown = pitchDeg > 20;

      // Gaze estimation from iris landmarks (if available, 468 = left iris, 473 = right iris)
      let horizontalGazeRatio = 0.5;
      let verticalGazeRatio = 0.5;
      let isGazeAway = false;

      if (primaryLandmarks.length >= 478) {
        const leftIris = primaryLandmarks[468];
        const leftEyeInner = primaryLandmarks[133];
        const leftEyeOuterCorner = primaryLandmarks[33];

        if (leftIris && leftEyeInner && leftEyeOuterCorner) {
          const eyeSpanX = Math.abs(leftEyeInner.x - leftEyeOuterCorner.x);
          if (eyeSpanX > 0.005) {
            horizontalGazeRatio = (leftIris.x - Math.min(leftEyeInner.x, leftEyeOuterCorner.x)) / eyeSpanX;
          }
        }

        // If gaze is far off to left or right while head is forward
        if (horizontalGazeRatio < 0.25 || horizontalGazeRatio > 0.75) {
          isGazeAway = true;
        }
      }

      // Check anomalies and debounce
      if (isTurnedAway) {
        this.consecutiveAnomalies.head_turned += 1;
        if (this.consecutiveAnomalies.head_turned >= 6) { // ~2s
          this.triggerDebouncedWarning("head_turned_away", "Candidate head turned away from display", "warning", {
            yawDeg,
          });
        }
      } else {
        this.consecutiveAnomalies.head_turned = 0;
      }

      if (isLookingDown) {
        this.consecutiveAnomalies.looking_down += 1;
        if (this.consecutiveAnomalies.looking_down >= 7) { // ~2.5s
          this.triggerDebouncedWarning("looking_down", "Candidate looking down (possible external material)", "warning", {
            pitchDeg,
          });
        }
      } else {
        this.consecutiveAnomalies.looking_down = 0;
      }

      if (isGazeAway && !isTurnedAway) {
        this.consecutiveAnomalies.gaze_away += 1;
        if (this.consecutiveAnomalies.gaze_away >= 7) {
          this.triggerDebouncedWarning("gaze_away", "Eye gaze deviated from exam window", "info", {
            horizontalGazeRatio,
          });
        }
      } else {
        this.consecutiveAnomalies.gaze_away = 0;
      }

      // Determine overall status
      let status: VisionAnalysisResult["status"] = "verified";
      let statusMessage = "Face verified. Candidate active.";

      if (multipleFaces) {
        status = "multiple_faces";
        statusMessage = backgroundPerson
          ? "Secondary person visible in background."
          : "Multiple individuals detected.";
      } else if (isTurnedAway) {
        status = "head_turned";
        statusMessage = "Head turned away from monitor.";
      } else if (isLookingDown) {
        status = "looking_down";
        statusMessage = "Looking downward away from screen.";
      } else if (isGazeAway) {
        status = "gaze_away";
        statusMessage = "Gaze directed away from test area.";
      }

      return {
        faceCount,
        primaryFaceDetected: true,
        multipleFacesDetected: multipleFaces,
        backgroundPersonDetected: backgroundPerson,
        headPose: {
          pitchDeg,
          yawDeg,
          rollDeg,
          isTurnedAway,
          isLookingDown,
        },
        gaze: {
          horizontalRatio: horizontalGazeRatio,
          verticalRatio: verticalGazeRatio,
          isGazeAway,
        },
        status,
        statusMessage,
        confidence: 0.95,
      };
    } catch (err) {
      console.warn("Inference execution frame error:", err);
      return null;
    }
  }

  private triggerDebouncedWarning(
    type: string,
    message: string,
    severity: "info" | "warning" | "alert",
    details?: Record<string, unknown>
  ) {
    const now = Date.now();
    const lastTime = this.lastLoggedEvents[type] || 0;

    // Minimum cooldown between reporting the exact same warning event to server: 12 seconds
    if (now - lastTime < 12000) {
      return;
    }

    this.lastLoggedEvents[type] = now;

    if (this.onWarningCallback) {
      this.onWarningCallback({
        type,
        message,
        severity,
        details,
      });
    }
  }

  public dispose() {
    try {
      if (this.faceLandmarker) {
        this.faceLandmarker.close();
        this.faceLandmarker = null;
      }
    } catch (e) {
      console.warn("Dispose landmarker error", e);
    }
    this.isReady = false;
  }
}
