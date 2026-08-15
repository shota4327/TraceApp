import React from 'react';
import { SAMPLE_PROGRAMS } from '../services/samplePrograms';

interface HeaderProps {
  selectedSampleId: string;
  onSelectSample: (id: string) => void;
  onFileUpload: (code: string) => void;
  statusText?: string;
}

/** タイトルおよびステータス表示サブコンポーネント */
const HeaderTitleGroup: React.FC<{ statusText: string }> = ({ statusText }) => {
  const isReady = statusText.includes('準備完了') || statusText.includes('ready');
  const isInitializing = statusText.includes('初期化中') || statusText.includes('loading');
  const dynamicStatusStyle: React.CSSProperties = {
    ...statusIndicatorStyle,
    backgroundColor: isReady ? '#dcfce7' : isInitializing ? '#fef9c3' : '#fee2e2',
    borderColor: isReady ? '#86efac' : isInitializing ? '#fde047' : '#fca5a5',
  };
  const dynamicTextStyle: React.CSSProperties = {
    ...statusTextStyle,
    color: isReady ? '#166534' : isInitializing ? '#854d0e' : '#991b1b',
  };

  return (
    <div style={titleGroupStyle}>
      <h1 style={titleStyle}>TraceApp - Python学習トレース可視化ツール</h1>
      <div id="status-indicator" data-testid="status-bar" className={`status-bar ${isReady ? 'ready' : isInitializing ? 'initializing' : 'error'}`} style={dynamicStatusStyle}>
        <span id="status-text" data-testid="status-text" style={dynamicTextStyle}>
          {statusText}
        </span>
      </div>
    </div>
  );
};

/** サンプル選択およびファイル読込サブコンポーネント */
const HeaderControls: React.FC<{
  selectedSampleId: string;
  onSelectSample: (id: string) => void;
  onFileUpload: (code: string) => void;
}> = ({ selectedSampleId, onSelectSample, onFileUpload }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) onFileUpload(content);
    };
    reader.readAsText(file);
  };

  return (
    <div style={controlsStyle}>
      <label style={labelStyle} htmlFor="preset-select">
        サンプル選択:
      </label>
      <select id="preset-select" data-testid="preset-select" value={selectedSampleId} onChange={(e) => onSelectSample(e.target.value)} style={selectStyle}>
        {SAMPLE_PROGRAMS.map((sample) => (
          <option key={sample.id} value={sample.id}>
            {sample.name}
          </option>
        ))}
      </select>
      <label style={uploadButtonStyle}>
        .py ファイル読込
        <input id="file-upload-input" data-testid="file-upload-input" type="file" accept=".py" onChange={handleFileChange} style={{ display: 'none' }} />
      </label>
    </div>
  );
};

/**
 * ヘッダーコンポーネント
 * アプリタイトルおよびステータスインジケータ、サンプル選択ドロップダウン、ファイル読込を表示
 */
export const Header: React.FC<HeaderProps> = ({
  selectedSampleId,
  onSelectSample,
  onFileUpload,
  statusText = '準備完了 (ready)',
}) => {
  return (
    <header id="header" data-testid="header" className="header-container" style={headerStyle}>
      <HeaderTitleGroup statusText={statusText} />
      <HeaderControls selectedSampleId={selectedSampleId} onSelectSample={onSelectSample} onFileUpload={onFileUpload} />
    </header>
  );
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 20px',
  backgroundColor: '#ffffff',
  borderBottom: '1px solid #e2e8f0',
};

const titleGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#1e293b',
};

const statusIndicatorStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: '12px',
  backgroundColor: '#dcfce7',
  border: '1px solid #86efac',
};

const statusTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 500,
  color: '#166534',
};

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#64748b',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const uploadButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '4px',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '0.875rem',
  cursor: 'pointer',
};
