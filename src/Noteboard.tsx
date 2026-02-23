import React, { useState, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { useToolbarShortcuts } from './hooks/useToolbarShortcuts';
import { DEFAULT_SLOTS } from './toolRegistry';
import type { NoteboardProps, Tool } from './types';

export const Noteboard: React.FC<NoteboardProps> = ({
    slots = DEFAULT_SLOTS,
    toolbarPosition = 'bottom',
    onToolSelect,
    activeTool: controlledTool,
}) => {
    const [internalTool, setInternalTool] = useState<Tool>('select');

    const currentTool = controlledTool ?? internalTool;

    const handleToolSelect = useCallback(
        (tool: Tool) => {
            if (!controlledTool) {
                setInternalTool(tool);
            }
            onToolSelect?.(tool);
        },
        [controlledTool, onToolSelect],
    );

    useToolbarShortcuts(slots, handleToolSelect);

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
            }}
        >
            <Toolbar
                slots={slots}
                position={toolbarPosition}
                activeTool={currentTool}
                onToolSelect={handleToolSelect}
            />
        </div>
    );
};
