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

  return (
    <Modal open={open} onClose={handleClose} title="Verify Your Vinyl" width="460px">
      {/* Record being verified */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', background: '#111', borderRadius: 10, marginBottom: 16 }}>
        <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={44} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f5' }}>{record.album}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.artist}</div>
        </div>
      </div>

      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid', borderColor: status === STATUS.VERIFIED ? '#3b82f644' : status === STATUS.FAILED ? '#ef444444' : '#1e1e1e', background: '#0a0a0a' }}>
        <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', background: status === STATUS.VERIFIED ? '#1e3a5f22' : status === STATUS.FAILED ? '#7f1d1d22' : 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>
              {status === STATUS.VERIFIED ? '✓' : status === STATUS.FAILED ? '✗' : status === STATUS.VERIFYING ? '...' : '📷'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: status === STATUS.VERIFIED ? '#3b82f6' : '#ccc', fontFamily: "'DM Mono',monospace", letterSpacing: '0.06em' }}>
              {status === STATUS.VERIFIED ? 'VERIFIED' : status === STATUS.FAILED ? 'FAILED' : status === STATUS.VERIFYING ? 'ANALYZING...' : 'TAKE A PHOTO'}
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#444', fontFamily: "'DM Mono',monospace" }}>powered by Claude</span>
        </div>

        <div style={{ padding: 16 }}>
          {status === STATUS.IDLE && (
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
                Show us your copy of <strong style={{ color: '#aaa' }}>{record.album}</strong> to earn a verified badge.
              </p>
              {camError && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{camError}</p>}
              <button onClick={startCamera} style={{ padding: '10px 22px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                📷 Open Camera
              </button>
            </div>
          )}

          {status === STATUS.CAPTURING && (
            <div>
              <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 8, display: 'block', maxHeight: 260, objectFit: 'cover', background: '#111' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => { stopStream(); setStatus(STATUS.IDLE); }} style={{ flex: 1, padding: 9, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={capturePhoto} style={{ flex: 2, padding: 9, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📸 Capture</button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {status === STATUS.CAPTURED && (
            <div>
              <img src={capturedSrc} alt="Captured" style={{ width: '100%', borderRadius: 8, maxHeight: 260, objectFit: 'cover' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={retake} style={{ flex: 1, padding: 9, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retake</button>
                <button onClick={verify} style={{ flex: 2, padding: 9, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✨ Verify with Claude AI</button>
              </div>
            </div>
          )}

          {status === STATUS.VERIFYING && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <img src={capturedSrc} alt="Verifying" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', opacity: 0.5, marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', height: 28 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', animation: `vr-bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
              <style>{`@keyframes vr-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }`}</style>
              <p style={{ fontSize: 12, color: '#555', marginTop: 10 }}>Claude is examining your vinyl...</p>
            </div>
          )}

          {status === STATUS.VERIFIED && (
            <div>
              <img src={capturedSrc} alt="Verified" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', border: '2px solid #3b82f655' }} />
              <p style={{ fontSize: 13, color: '#3b82f6', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>{message}</p>
              <button onClick={handleClose} style={{ marginTop: 12, width: '100%', padding: 11, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ✓ Done
              </button>
            </div>
          )}

          {status === STATUS.FAILED && (
            <div>
              {capturedSrc && <img src={capturedSrc} alt="Rejected" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', opacity: 0.6, border: '2px solid #ef444455' }} />}
              <p style={{ fontSize: 13, color: '#f87171', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>{message}</p>
              <button onClick={retake} style={{ marginTop: 10, width: '100%', padding: 9, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#aaa', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📷 Try Again</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
