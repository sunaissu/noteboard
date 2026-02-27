import { Noteboard } from '@sunaissu/noteboard'
import type { Tool, ToolSlot } from '@sunaissu/noteboard'
import { useState } from 'react'

const customSlots: ToolSlot[] = [
    { position: 1, toolId: 'select' },
    { position: 2, toolId: 'pan' },
    { position: 3, toolId: 'rectangle' },
    { position: 4, toolId: 'line' },
    { position: 5, toolId: 'arrow' },
    { position: 6, toolId: 'pen' },
    { position: 7, toolId: 'text' },
    { position: 8, toolId: 'eraser' },
]

function App() {
    const [activeTool, setActiveTool] = useState<Tool>('select')
    const [position, setPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')
    const [propertiesPosition, setPropertiesPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')

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

            <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <label>Properties position:</label>
                {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
                    <button
                        key={pos}
                        onClick={() => setPropertiesPosition(pos)}
                        style={{
                            padding: '4px 12px',
                            borderRadius: 6,
                            border: '1px solid #ccc',
                            background: propertiesPosition === pos ? '#e8590c' : '#fff',
                            color: propertiesPosition === pos ? '#fff' : '#333',
                            cursor: 'pointer',
                        }}
                    >
                        {pos}
                    </button>
                ))}
            </div>

            <div
                style={{
                    width: '100%',
                    height: 500,
                    border: '1px solid #ddd',
                    borderRadius: 12,
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                <Noteboard
                    slots={customSlots}
                    toolbarPosition={position}
                    activeTool={activeTool}
                    onToolSelect={setActiveTool}
                    propertiesPosition={propertiesPosition}
                />
            </div>

            <p style={{ marginTop: 12, color: '#888', fontSize: 14 }}>
                Press keys <kbd>1</kbd>–<kbd>{customSlots.length}</kbd> to switch tools.
                Use the <strong>☰ menu</strong> in the top-right to toggle dark mode.
            </p>
        </div>
    )
}

export default App
