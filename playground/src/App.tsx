import { Noteboard } from '@sunaissu/noteboard'
import type { Tool, ToolSlot } from '@sunaissu/noteboard'
import { useState } from 'react'

const customSlots: ToolSlot[] = [
    { position: 1, toolId: 'select' },
    { position: 2, toolId: 'pan' },
    { position: 3, toolId: 'line' },
    { position: 4, toolId: 'rectangle' },
    { position: 5, toolId: 'text' },
    { position: 6, toolId: 'arrow' },
    { position: 7, toolId: 'eraser' },
]

function App() {
    const [activeTool, setActiveTool] = useState<Tool>('select')
    const [position, setPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20 }}>
            <h1>Noteboard Playground</h1>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <label>Toolbar position:</label>
                {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
                    <button
                        key={pos}
                        onClick={() => setPosition(pos)}
                        style={{
                            padding: '4px 12px',
                            borderRadius: 6,
                            border: '1px solid #ccc',
                            background: position === pos ? '#6c47ff' : '#fff',
                            color: position === pos ? '#fff' : '#333',
                            cursor: 'pointer',
                        }}
                    >
                        {pos}
                    </button>
                ))}
                <span style={{ marginLeft: 16, color: '#666' }}>
                    Active: <strong>{activeTool}</strong>
                </span>
            </div>

            <div
                style={{
                    width: '100%',
                    height: 500,
                    border: '1px solid #ddd',
                    borderRadius: 12,
                    background: '#fafafa',
                    position: 'relative',
                }}
            >
                <Noteboard
                    slots={customSlots}
                    toolbarPosition={position}
                    activeTool={activeTool}
                    onToolSelect={setActiveTool}
                />
            </div>

            <p style={{ marginTop: 12, color: '#888', fontSize: 14 }}>
                Press keys <kbd>1</kbd>–<kbd>7</kbd> to switch tools via keyboard shortcuts.
            </p>
        </div>
    )
}

export default App
