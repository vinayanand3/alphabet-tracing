
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ALPHABET, COLORS } from './constants';
import ParticleSystem, { ParticleSystemRef } from './components/ParticleSystem';
import { createGeminiSession } from './services/geminiService';
import { playLetterAnnouncement, playSuccessSound } from './services/audioHelper';
import LetterProgress from './components/LetterProgress';

declare const window: any;

const App: React.FC = () => {
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [handLandmarker, setHandLandmarker] = useState<any>(null);
  const [traceProgress, setTraceProgress] = useState(0);
  const [isExploding, setIsExploding] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [completedLetters, setCompletedLetters] = useState<Set<string>>(new Set());
  const [isGrandFinale, setIsGrandFinale] = useState(false);
  const [hasStartedTracing, setHasStartedTracing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleRef = useRef<ParticleSystemRef>(null);
  const hitPoints = useRef<Set<string>>(new Set());
  const lastEmitTime = useRef(0);
  const dashOffset = useRef(0);

  const currentLetter = ALPHABET[currentLetterIndex];

  // Initialize MediaPipe
  useEffect(() => {
    const initVision = async () => {
      const { vision } = window as any;
      if (!vision) return;
      const filesetResolver = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      const landmarker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });
      setHandLandmarker(landmarker);
    };
    initVision();
  }, []);

  // TTS on Letter Change
  useEffect(() => {
    if (isReady && !isGrandFinale) {
      playLetterAnnouncement(currentLetter);
      setHasStartedTracing(false);
    }
  }, [currentLetterIndex, isReady, isGrandFinale]);

  // Start Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsReady(true);
          };
        }
      } catch (err) { console.error(err); }
    };
    startCamera();
  }, []);

  const triggerGrandFinale = useCallback(() => {
    setIsGrandFinale(true);
    let count = 0;
    const interval = setInterval(() => {
      particleRef.current?.explode(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 50);
      count++;
      if (count > 20) clearInterval(interval);
    }, 300);

    session?.then((s: any) => {
      s.sendRealtimeInput({
        text: "The child finished the WHOLE alphabet! Give a massive grand final celebration speech!"
      });
    });
  }, [session]);

  const celebrate = useCallback(() => {
    setIsExploding(true);
    playSuccessSound();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && particleRef.current) {
      particleRef.current.explode(rect.left + rect.width / 2, rect.top + rect.height / 2, 150);
    }

    setCompletedLetters(prev => new Set(prev).add(currentLetter));
    
    session?.then((s: any) => {
      s.sendRealtimeInput({
        text: `The child successfully traced ${currentLetter}! Say something super positive!`
      });
    });

    setTimeout(() => {
      if (currentLetterIndex === ALPHABET.length - 1) {
        triggerGrandFinale();
      } else {
        setCurrentLetterIndex(prev => prev + 1);
        setTraceProgress(0);
        hitPoints.current.clear();
        setIsExploding(false);
      }
    }, 2000);
  }, [currentLetter, currentLetterIndex, session, triggerGrandFinale]);

  useEffect(() => {
    if (!isReady || !handLandmarker || !videoRef.current || !canvasRef.current || isGrandFinale) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let lastVideoTime = -1;
    let animationFrame: number;

    const render = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const detections = handLandmarker.detectForVideo(video, performance.now());
        canvasRef.current!.width = video.videoWidth;
        canvasRef.current!.height = video.videoHeight;
        
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvasRef.current!.width, 0);
        
        const cx = canvasRef.current!.width / 2;
        const cy = canvasRef.current!.height / 2;
        ctx.font = 'bold 450px "Fredoka One"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. Draw "Shadow" Path (The goal)
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
        ctx.lineWidth = 120;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeText(currentLetter, cx, cy);

        // 2. Draw Dash Guide (The "Road")
        dashOffset.current -= 1;
        ctx.setLineDash([20, 20]);
        ctx.lineDashOffset = dashOffset.current;
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 10;
        ctx.strokeText(currentLetter, cx, cy);
        ctx.setLineDash([]); // Reset dash

        // Calculate a "Start Point" (roughly top-center of the letter area)
        const startX = cx;
        const startY = cy - 150;

        // 3. Draw Start Hint if not tracing
        if (!hasStartedTracing) {
          ctx.beginPath();
          const pulse = Math.sin(Date.now() / 200) * 10 + 30;
          ctx.arc(startX, startY, pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(74, 222, 128, 0.4)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(startX, startY, 15, 0, Math.PI * 2);
          ctx.fillStyle = '#4ade80';
          ctx.fill();
        }

        if (detections.landmarks?.[0]) {
          const landmarks = detections.landmarks[0];
          const indexTip = landmarks[8];
          const tx = indexTip.x * canvasRef.current!.width;
          const ty = indexTip.y * canvasRef.current!.height;

          // Check for starting point hit
          if (!hasStartedTracing) {
            const dist = Math.sqrt((tx - startX) ** 2 + (ty - startY) ** 2);
            if (dist < 50) setHasStartedTracing(true);
          }

          // Hit detection on the thick path
          const hitCtx = canvasRef.current!.getContext('2d', { willReadFrequently: true })!;
          const pixel = hitCtx.getImageData(tx, ty, 1, 1).data;
          
          if (pixel[3] > 0 && hasStartedTracing) {
            const pointKey = `${Math.floor(tx / 8)},${Math.floor(ty / 8)}`;
            if (!hitPoints.current.has(pointKey)) {
              hitPoints.current.add(pointKey);
              particleRef.current?.emitAt(tx, ty);
              const progress = Math.min(100, (hitPoints.current.size / 80) * 100);
              setTraceProgress(progress);
              if (progress >= 95 && !isExploding) celebrate();
            }
          }

          // Finger Sparkle
          ctx.beginPath();
          ctx.arc(tx, ty, 15, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.GOLD;
          ctx.shadowBlur = 25;
          ctx.shadowColor = COLORS.GOLD;
          ctx.fill();
        }

        // 4. Draw User's Trace
        ctx.fillStyle = COLORS.GOLD;
        ctx.globalCompositeOperation = 'source-atop';
        hitPoints.current.forEach(point => {
          const [px, py] = point.split(',').map(Number);
          ctx.beginPath();
          ctx.arc(px * 8, py * 8, 45, 0, Math.PI * 2);
          ctx.fill();
        });
        
        ctx.restore();

        // Feed Gemini
        const now = Date.now();
        if (now - lastEmitTime.current > 3000) {
          lastEmitTime.current = now;
          canvasRef.current.toBlob((blob) => {
            if (blob && session) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                session.then((s: any) => s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } }));
              };
              reader.readAsDataURL(blob);
            }
          }, 'image/jpeg', 0.5);
        }
      }
      animationFrame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [isReady, handLandmarker, currentLetter, isExploding, celebrate, isGrandFinale, session, hasStartedTracing]);

  return (
    <div className="relative w-screen h-screen bg-slate-900 flex items-center justify-center overflow-hidden">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-30 scale-x-[-1]" muted playsInline />
      
      {/* Visual background guide text for "Hollow" look */}
      {!isGrandFinale && !isExploding && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
           <span className="text-[500px] font-magic text-white select-none">{currentLetter}</span>
        </div>
      )}

      <canvas ref={canvasRef} className={`relative z-10 w-full h-full max-w-5xl max-h-[80vh] transition-transform duration-1000 ${isExploding ? 'rotate-[360deg] scale-0 opacity-0' : 'scale-100'}`} />
      <ParticleSystem ref={particleRef} />
      
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none z-20">
        <div>
          <h1 className="text-5xl font-magic text-amber-400 drop-shadow-lg">Golden Trace</h1>
          <p className="text-amber-100 mt-2 font-bold text-lg">
            {hasStartedTracing ? "Keep going! ✨" : "Start at the green light! 🟢"}
          </p>
        </div>
        <div className="bg-slate-800/80 p-4 rounded-2xl border-4 border-amber-500 shadow-xl backdrop-blur-sm">
          <div className="text-xl font-magic text-white">Mastery: {Math.round((completedLetters.size / 26) * 100)}%</div>
        </div>
      </div>

      <LetterProgress completedLetters={completedLetters} currentIndex={currentLetterIndex} />

      {isGrandFinale && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black/60 backdrop-blur-lg animate-in fade-in duration-1000">
           <div className="animate-bounce scale-150 text-center">
            <span className="text-9xl font-magic text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,1)]">ALPHABET MASTER!</span>
            <p className="text-3xl text-white mt-8 font-magic">Sparky is so proud of you!</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-12 bg-amber-500 hover:bg-amber-400 text-slate-900 px-12 py-4 rounded-full text-3xl font-magic pointer-events-auto shadow-2xl transition-transform active:scale-95"
            >
              Play Again!
            </button>
          </div>
        </div>
      )}

      {isExploding && !isGrandFinale && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-ping"><span className="text-8xl font-magic text-amber-400">AMAZING!</span></div>
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 bg-slate-950/90 z-[100] flex flex-col items-center justify-center text-center p-6">
          <div className="w-24 h-24 border-8 border-amber-500 border-t-transparent rounded-full animate-spin mb-8" />
          <h2 className="text-4xl font-magic text-white mb-4">Waking up Sparky...</h2>
          <p className="text-slate-400">Make sure your camera is on!</p>
        </div>
      )}
    </div>
  );
};

export default App;
