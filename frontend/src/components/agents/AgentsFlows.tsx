import React, { useState } from 'react';
import type { AgentFlow } from './types';
import { FlowsList } from './flows/FlowsList';
import { FlowCanvas } from './flows/FlowCanvas';
import { FlowExecutionModal } from './flows/FlowExecutionModal';

export const AgentsFlows: React.FC = () => {
  const [selectedFlow, setSelectedFlow] = useState<AgentFlow | null>(null);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {!selectedFlow ? (
        <FlowsList
          onOpenCanvas={(flow) => setSelectedFlow(flow)}
          onOpenExecution={(execId) => setActiveExecutionId(execId)}
        />
      ) : (
        <FlowCanvas
          flow={selectedFlow}
          onBack={() => setSelectedFlow(null)}
          onSaveSuccess={(updated) => setSelectedFlow(updated)}
          onOpenExecution={(execId) => setActiveExecutionId(execId)}
        />
      )}

      {/* Execution Steps Modal */}
      {activeExecutionId && (
        <FlowExecutionModal
          executionId={activeExecutionId}
          onClose={() => setActiveExecutionId(null)}
        />
      )}
    </div>
  );
};
