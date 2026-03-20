// Modal to verify a record after it's been added to the collection.
// Uses the same VinylCamera flow from AddRecordModal.
// On success, calls onVerified(recordId) which sets verified:true on the record.
import { useState, useRef, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import AlbumArt from '../ui/AlbumArt';
import { verifyVinyl } from '../../utils/verifyVinyl';

const STATUS = { IDLE: 'idle', CAPTURING: 'capturing', CAPTURED: 'captured', VERIFYING: 'verifying', VERIFIED: 'verified', FAILED: 'failed' };

export default function VerifyRecordModal({ open, onClose, record, onVerified }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [capturedSrc, setCapturedSrc] = useState(null);
  const [capturedBase64, setCapturedBase64] = useState(null);
  const [message, setMessage] = useState('');
  const [camError, setCamError] = useState('');
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

  return (
    <Modal open={open} onClose={handleClose} title="Verify Your Vinyl" width="460px">
      {/* Record being verified */}
      <div className="flex gap-3 items-center px-3.5 py-3 bg-[#111] rounded-[10px] mb-4">
        <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={44} />
        <div>
          <div className="text-sm font-bold text-gs-text">{record.album}</div>
          <div className="text-xs text-[#666]">{record.artist}</div>
        </div>
      </div>

      <div className={`rounded-xl overflow-hidden border ${borderColorClass} bg-gs-sidebar`}>
        <div className={`px-4 py-[11px] flex items-center justify-between border-b border-[#1a1a1a] ${headerBgClass}`}>
          <div className="flex items-center gap-2">
            <span className="text-base">
              {status === STATUS.VERIFIED ? '✓' : status === STATUS.FAILED ? '✗' : status === STATUS.VERIFYING ? '...' : '📷'}
            </span>
            <span className={`text-xs font-bold ${statusLabelColor} font-mono tracking-wider`}>
              {status === STATUS.VERIFIED ? 'VERIFIED' : status === STATUS.FAILED ? 'FAILED' : status === STATUS.VERIFYING ? 'ANALYZING...' : 'TAKE A PHOTO'}
            </span>
          </div>
          <span className="text-[10px] text-gs-faint font-mono">powered by Claude</span>
        </div>

        <div className="p-4">
          {status === STATUS.IDLE && (
            <div className="text-center pt-2 pb-1">
              <p className="text-[13px] text-[#666] mb-3.5 leading-normal">
                Show us your copy of <strong className="text-[#aaa]">{record.album}</strong> to earn a verified badge.
              </p>
              {camError && <p className="text-xs text-red-400 mb-3">{camError}</p>}
              <button onClick={startCamera} className="gs-btn-gradient px-[22px] py-2.5 rounded-[10px] text-[13px] font-bold cursor-pointer">
                📷 Open Camera
              </button>
            </div>
          )}

          {status === STATUS.CAPTURING && (
            <div>
              <video ref={videoRef} playsInline muted className="w-full rounded-lg block max-h-[260px] object-cover bg-[#111]" />
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => { stopStream(); setStatus(STATUS.IDLE); }} className="gs-btn-secondary flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer">Cancel</button>
                <button onClick={capturePhoto} className="gs-btn-gradient flex-[2] py-2.5 rounded-lg text-[13px] font-bold cursor-pointer">📸 Capture</button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {status === STATUS.CAPTURED && (
            <div>
              <img src={capturedSrc} alt="Captured" className="w-full rounded-lg max-h-[260px] object-cover" />
              <div className="flex gap-2 mt-2.5">
                <button onClick={retake} className="gs-btn-secondary flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer">Retake</button>
                <button onClick={verify} className="gs-btn-gradient flex-[2] py-2.5 rounded-lg text-[13px] font-bold cursor-pointer">✨ Verify with Claude AI</button>
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
                ✓ Done
              </button>
            </div>
          )}

          {status === STATUS.FAILED && (
            <div>
              {capturedSrc && <img src={capturedSrc} alt="Rejected" className="w-full rounded-lg max-h-[200px] object-cover opacity-60 border-2 border-red-500/30" />}
              <p className="text-[13px] text-red-400 mt-2.5 leading-normal text-center">{message}</p>
              <button onClick={retake} className="gs-btn-secondary mt-2.5 w-full py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer">📷 Try Again</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
