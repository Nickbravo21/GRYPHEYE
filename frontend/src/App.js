import React, { useState, useCallback } from 'react';
import './App.css';
import UploadPanel from './components/UploadPanel';
import QueryInput from './components/QueryInput';
import ToggleControls from './components/ToggleControls';
import PreviewWindow from './components/PreviewWindow';
import ResultsDisplay from './components/ResultsDisplay';
import { detectImage, detectVideo, pollJobStatus } from './services/api';

const TARGET_ICON = (
  <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
    <circle cx="17" cy="17" r="15" stroke="#00ff41" strokeWidth="1.5" />
    <circle cx="17" cy="17" r="9" stroke="#00ff41" strokeWidth="1" strokeDasharray="3 2" />
    <circle cx="17" cy="17" r="3" fill="#00ff41" />
    <line x1="17" y1="2" x2="17" y2="8" stroke="#00ff41" strokeWidth="1.5" />
    <line x1="17" y1="26" x2="17" y2="32" stroke="#00ff41" strokeWidth="1.5" />
    <line x1="2" y1="17" x2="8" y2="17" stroke="#00ff41" strokeWidth="1.5" />
    <line x1="26" y1="17" x2="32" y2="17" stroke="#00ff41" strokeWidth="1.5" />
  </svg>
);

export default function App() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(null); // 'image' | 'video'
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState({
    useSam: true,
    useTracking: true,
    showBoxes: true,
    showMasks: true,
    boxThreshold: 0.25,
    textThreshold: 0.25,
  });

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { image?, videoUrl?, detections, count }

  const handleFileSelect = useCallback((selectedFile, type) => {
    setFile(selectedFile);
    setFileType(type);
    setResult(null);
    setError(null);
  }, []);

  const handleDetect = async () => {
    if (!file || !query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      if (fileType === 'image') {
        const data = await detectImage(file, query, options);
        setResult({
          type: 'image',
          image: data.image,
          detections: data.detections,
          count: data.count,
        });
      } else {
        const { job_id } = await detectVideo(file, query, options);

        // Poll until done
        const pollResult = await pollJobStatus(job_id, (pct) => setProgress(pct));
        const videoUrl = `/api/job/${job_id}/result`;
        setResult({
          type: 'video',
          videoUrl,
          detections: pollResult.result?.sample_detections || [],
          count: pollResult.result?.detection_count || 0,
          frames: pollResult.result?.total_frames,
          fps: pollResult.result?.fps,
        });
      }
    } catch (err) {
      setError(err.message || 'Detection failed. Check backend logs.');
    } finally {
      setLoading(false);
    }
  };

  const toggleOption = (key, value) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const canDetect = file && query.trim() && !loading;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <div className="header-icon">{TARGET_ICON}</div>
          <div>
            <div className="header-title">GRYPHEYE</div>
            <div className="header-subtitle">
              OPEN-VOCABULARY DETECTION · SEGMENTATION · TRACKING
            </div>
          </div>
        </div>
        <div className="header-status">
          <div className="status-dot" />
          SYSTEM ONLINE
        </div>
      </header>

      <main className="app-main">
        {/* ── Left panel ── */}
        <aside className="left-panel">
          <div>
            <div className="section-label">01 · UPLOAD TARGET MEDIA</div>
            <UploadPanel onFileSelect={handleFileSelect} disabled={loading} />
          </div>

          <div>
            <div className="section-label">02 · DETECTION QUERY</div>
            <QueryInput
              value={query}
              onChange={setQuery}
              disabled={loading}
              onSubmit={handleDetect}
            />
          </div>

          <div>
            <div className="section-label">03 · OPTIONS</div>
            <ToggleControls
              options={options}
              fileType={fileType}
              onChange={toggleOption}
              disabled={loading}
            />
          </div>

          <button
            className={`detect-btn${loading ? ' processing' : ''}`}
            onClick={handleDetect}
            disabled={!canDetect}
          >
            {loading
              ? fileType === 'video'
                ? `PROCESSING VIDEO… ${progress}%`
                : 'ANALYZING IMAGE…'
              : 'INITIATE DETECTION'}
          </button>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255,65,54,0.1)',
              border: '1px solid rgba(255,65,54,0.4)',
              borderRadius: 3,
              color: '#ff4136',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
            }}>
              ⚠ {error}
            </div>
          )}
        </aside>

        {/* ── Right panel ── */}
        <div className="right-panel">
          <PreviewWindow
            result={result}
            loading={loading}
            progress={progress}
            fileType={fileType}
            file={file}
          />
          <ResultsDisplay result={result} />
        </div>
      </main>

      <footer className="app-footer">
        <span>GRYPHEYE version 0.02 · Grounding DINO + SAM + ByteTrack</span>
        <span>CLASSIFICATION: UNCLASSIFIED // FOR DEMONSTRATION USE ONLY</span>
      </footer>
    </div>
  );
}
