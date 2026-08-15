import React from 'react';
import { VariableTable } from './VariableTable';
import { OutputConsole } from './OutputConsole';
import { StepSnapshot } from '../types/trace';

interface RightPanelProps {
  snapshots?: StepSnapshot[];
  currentStepIndex?: number;
  stdout?: string;
}

/**
 * 右パネルコンポーネント
 * 上部60%の変数履歴表および下部40%の標準出力コンソールを保持
 */
export const RightPanel: React.FC<RightPanelProps> = ({
  snapshots = [],
  currentStepIndex = 0,
  stdout = '',
}) => {
  return (
    <div style={containerStyle}>
      <div style={topPanelStyle}>
        <VariableTable
          snapshots={snapshots}
          currentStepIndex={currentStepIndex}
        />
      </div>
      <div style={bottomPanelStyle}>
        <OutputConsole stdout={stdout} />
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#ffffff',
};

const topPanelStyle: React.CSSProperties = {
  flex: '0 0 60%',
  overflow: 'hidden',
};

const bottomPanelStyle: React.CSSProperties = {
  flex: '0 0 40%',
  overflow: 'hidden',
};
