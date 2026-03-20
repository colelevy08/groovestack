// Modal to verify a record after it's been added to the collection.
// Uses the same VinylCamera flow from AddRecordModal.
// On success, calls onVerified(recordId) which sets verified:true on the record.
import { useState, useRef, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import AlbumArt from '../ui/AlbumArt';
import { verifyVinyl } from '../../utils/verifyVinyl';

const STATUS = { IDLE: 'idle', CAPTURING: 'capturing', CAPTURED: 'captured', VERIFYING: 'verifying', VERIFIED: 'verified', FAILED: 'failed' };

// #31 — Progress steps
const PROGRESS_STEPS = [
  { key: 'photo', label: 'Take Photo' },
  { key: 'review', label: 'Review' },
  { key: 'verify', label: 'Verify' },
  { key: 'result', label: 'Result' },
];

function getProgressIndex(status) {
  if (status === STATUS.IDLE || status === STATUS.CAPTURING) return 0;
  if (status === STATUS.CAPTURED) return 1;
  if (status === STATUS.VERIFYING) return 2;
  return 3;
}

export default function VerifyRecordModal({ open, onClose, record, onVerified, verificationHistory = [] }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [capturedSrc, setCapturedSrc] = useState(null);
  const [capturedBase64, setCapturedBase64] = useState(null);
  const [message, setMessage] = useState('');
  const [camError, setCamError] = useState('');
  const [showTips, setShowTips] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStatus(STATUS.IDLE);
      setCapturedSrc(null);
      setCapturedBase64(null);
      setMessage('');
      setCamError('');
      setShowTips(false);
      setShowHistory(false);
    }
  }, [open]);

  const startCamera = async () => {
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStatus(STATUS.CAPTURING);
    } catch {
      setCamError('Camera access denied. Please allow camera access and try again.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stopStream();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedSrc(dataUrl);
    setCapturedBase64(dataUrl.split(',')[1]);
    setStatus(STATUS.CAPTURED);
  };

  // #30 — Re-take photo option
  const retake = () => {
    setCapturedSrc(null);
    setCapturedBase64(null);
    setMessage('');
    startCamera();
  };

  const verify = async () => {
    setStatus(STATUS.VERIFYING);
    try {
      const result = await verifyVinyl(capturedBase64, 'image/jpeg');
      setMessage(result.message);
      if (result.verified) {
        setStatus(STATUS.VERIFIED);
        onVerified(record.id);
      } else {
        setStatus(STATUS.FAILED);
      }
    } catch (err) {
      setMessage(err.message || 'Verification service unavailable.');
      setStatus(STATUS.FAILED);
    }
  };

  const handleClose = () => { stopStream(); onClose(); };

  if (!open || !record) return null;

  const borderColorClass = status === STATUS.VERIFIED ? 'border-blue-500/25' : status === STATUS.FAILED ? 'border-red-500/25' : 'border-gs-border';
  const headerBgClass = status === STATUS.VERIFIED ? 'bg-blue-900/10' : status === STATUS.FAILED ? 'bg-red-900/10' : 'bg-transparent';
  const statusLabelColor = status === STATUS.VERIFIED ? 'text-blue-500' : 'text-neutral-400';
  const progressIdx = getProgressIndex(status);

  return (
    <Modal open={open} onClose={handleClose} title="Verify Your Vinyl" width="460px">
      {/* Record being verified */}
      <div className="flex gap-3 items-center px-3.5 py-3 bg-[#111] rounded-[10px] mb-4">
        <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={44} />
        <div className="flex-1">
          <div className="text-sm font-bold text-gs-text">{record.album}</div>
          <div className="text-xs text-[#666]">{record.artist}</div>
        </div>
        {/* #32 — Verification history toggle */}
        {verificationHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(h => !h)}
            className="text-[10px] text-gs-dim hover:text-gs-muted cursor-pointer bg-transparent border-none font-semibold"
          >
            History ({verificationHistory.length})
          </button>
        )}
      </div>

      {/* #32 — Verification history panel */}
      {showHistory && verificationHistory.length > 0 && (
        <div className="bg-[#111] rounded-lg p-3 mb-4 max-h-[120px] overflow-y-auto">
          <div className="text-[10px] font-bold text-gs-dim tracking-[0.08em] mb-2 font-mono">PREVIOUS VERIFICATIONS</div>
          {verificationHistory.map((h, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${h.verified ? 'text-blue-400' : 'text-red-400'}`}>
                  {h.verified ? 'PASS' : 'FAIL'}
                </span>
                <span className="text-[10px] text-gs-muted">{h.album}</span>
              </div>
              <span className="text-[10px] text-gs-faint font-mono">{h.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* #31 — Verification progress indicator */}
      <div className="flex items-center gap-1 mb-4 px-1">
        {PROGRESS_STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  i < progressIdx ? 'bg-blue-500/20 text-blue-400' :
                  i === progressIdx ? 'bg-gs-accent/15 text-gs-accent border border-gs-accent/30' :
                  'bg-[#111] text-gs-dim border border-gs-border'
                }`}
              >
                {i < progressIdx ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : i + 1}
              </div>
              <span className={`text-[9px] mt-1 ${i <= progressIdx ? 'text-gs-muted' : 'text-gs-faint'}`}>{s.label}</span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-1 ${i < progressIdx ? 'bg-blue-500/30' : 'bg-gs-border'}`} />
            )}
          </div>
        ))}
      </div>

      <div className={`rounded-xl overflow-hidden border ${borderColorClass} bg-gs-sidebar`}>
        <div className={`px-4 py-[11px] flex items-center justify-between border-b border-[#1a1a1a] ${headerBgClass}`}>
          <div className="flex items-center gap-2">
            <span className="text-base">
              {status === STATUS.VERIFIED ? '\u2713' : status === STATUS.FAILED ? '\u2717' : status === STATUS.VERIFYING ? '...' : '\uD83D\uDCF7'}
            </span>
            <span className={`text-xs font-bold ${statusLabelColor} font-mono tracking-wider`}>
              {status === STATUS.VERIFIED ? 'VERIFIED' : status === STATUS.FAILED ? 'FAILED' : status === STATUS.VERIFYING ? 'ANALYZING...' : 'TAKE A PHOTO'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* #29 — Photo quality tips toggle */}
            <button
              onClick={() => setShowTips(t => !t)}
              className="text-[10px] text-gs-dim hover:text-gs-muted cursor-pointer bg-transparent border-none font-semibold"
            >
              Tips
            </button>
            <span className="text-[10px] text-gs-faint font-mono">powered by Claude</span>
          </div>
        </div>

        {/* #29 — Photo quality tips/guide */}
        {showTips && (
          <div className="px-4 py-3 bg-[#0ea5e908] border-b border-[#1a1a1a]">
            <div className="text-[10px] font-bold text-gs-dim mb-1.5 tracking-[0.08em] font-mono">PHOTO TIPS</div>
            <ul className="text-[11px] text-gs-muted leading-relaxed space-y-1 list-none p-0 m-0">
              <li className="flex items-start gap-1.5"><span className="text-gs-accent shrink-0">-</span> Use good lighting; avoid shadows on the cover</li>
              <li className="flex items-start gap-1.5"><span className="text-gs-accent shrink-0">-</span> Include the full album cover in frame</li>
              <li className="flex items-start gap-1.5"><span className="text-gs-accent shrink-0">-</span> Hold camera steady and avoid blur</li>
              <li className="flex items-start gap-1.5"><span className="text-gs-accent shrink-0">-</span> Show the vinyl label if possible for best results</li>
            </ul>
          </div>
        )}

        <div className="p-4">
          {status === STATUS.IDLE && (
            <div className="text-center pt-2 pb-1">
              <p className="text-[13px] text-[#666] mb-3.5 leading-normal">
                Show us your copy of <strong className="text-[#aaa]">{record.album}</strong> to earn a verified badge.
              </p>
              {camError && <p className="text-xs text-red-400 mb-3">{camError}</p>}
              <button onClick={startCamera} className="gs-btn-gradient px-[22px] py-2.5 rounded-[10px] text-[13px] font-bold cursor-pointer">
                Open Camera
              </button>
            </div>
          )}

          {/* #28 — Camera preview before capture */}
          {status === STATUS.CAPTURING && (
            <div>
              <div className="relative">
                <video ref={videoRef} playsInline muted className="w-full rounded-lg block max-h-[260px] object-cover bg-[#111]" />
                {/* Camera overlay guide */}
                <div className="absolute inset-4 border-2 border-dashed border-white/20 rounded-lg pointer-events-none" />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/60 bg-black/50 rounded-full px-3 py-1">
                  Center album cover in frame
                </div>
              </div>
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => { stopStream(); setStatus(STATUS.IDLE); }} className="gs-btn-secondary flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer">Cancel</button>
                <button onClick={capturePhoto} className="gs-btn-gradient flex-[2] py-2.5 rounded-lg text-[13px] font-bold cursor-pointer">Capture</button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* #30 — Captured photo with retake option */}
          {status === STATUS.CAPTURED && (
            <div>
              <img src={capturedSrc} alt="Captured" className="w-full rounded-lg max-h-[260px] object-cover" />
              <p className="text-[11px] text-gs-dim text-center mt-2 mb-1">Review your photo. Make sure the cover is clear and readable.</p>
              <div className="flex gap-2 mt-2.5">
                <button onClick={retake} className="gs-btn-secondary flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer">Retake</button>
                <button onClick={verify} className="gs-btn-gradient flex-[2] py-2.5 rounded-lg text-[13px] font-bold cursor-pointer">Verify with Claude AI</button>
              </div>
            </div>
          )}

          {status === STATUS.VERIFYING && (
            <div className="text-center py-2.5">
              <img src={capturedSrc} alt="Verifying" className="w-full rounded-lg max-h-[200px] object-cover opacity-50 mb-3.5" />
              <div className="flex gap-1.5 justify-center items-center h-7">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500" style={{ animation: `vr-bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
              <style>{`@keyframes vr-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }`}</style>
              <p className="text-xs text-gs-dim mt-2.5">Claude is examining your vinyl...</p>
            </div>
          )}

          {status === STATUS.VERIFIED && (
            <div>
              <img src={capturedSrc} alt="Verified" className="w-full rounded-lg max-h-[200px] object-cover border-2 border-blue-500/30" />
              <p className="text-[13px] text-blue-500 mt-2.5 leading-normal text-center">{message}</p>
              <button onClick={handleClose} className="gs-btn-gradient mt-3 w-full py-[11px] rounded-[10px] text-[13px] font-bold cursor-pointer">
                Done
              </button>
            </div>
          )}

          {status === STATUS.FAILED && (
            <div>
              {capturedSrc && <img src={capturedSrc} alt="Rejected" className="w-full rounded-lg max-h-[200px] object-cover opacity-60 border-2 border-red-500/30" />}
              <p className="text-[13px] text-red-400 mt-2.5 leading-normal text-center">{message}</p>
              <button onClick={retake} className="gs-btn-secondary mt-2.5 w-full py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer">Try Again</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
