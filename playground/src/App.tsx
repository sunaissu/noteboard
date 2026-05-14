import { Noteboard } from '@sunaissu/noteboard'
import type { Tool, ToolSlot, NoteboardRef } from '@sunaissu/noteboard'
import { useState, useRef, useCallback } from 'react'

const customSlots: ToolSlot[] = [
    { position: 1, toolId: 'select' },
    { position: 2, toolId: 'pan' },
    { position: 3, toolId: 'rectangle' },
    { position: 4, toolId: 'line' },
    { position: 5, toolId: 'arrow' },
    { position: 6, toolId: 'pen' },
    { position: 7, toolId: 'text' },
    { position: 8, toolId: 'eraser' },
    { position: 9, toolId: 'image' },
]

function App() {
    const [activeTool, setActiveTool] = useState<Tool>('select')
    const [position, setPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')
    const [propertiesPosition, setPropertiesPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('left')
    const noteboardRef = useRef<NoteboardRef>(null)

    const handleExportPNG = useCallback(() => {
        if (!noteboardRef.current) return
        const dataUrl = noteboardRef.current.exportImage('png')
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = 'noteboard-export.png'
        a.click()
    }, [])

    const handleExportJSON = useCallback(() => {
        if (!noteboardRef.current) return
        const elements = noteboardRef.current.getElements()
        const json = JSON.stringify(elements, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'noteboard-export.json'
        a.click()
        URL.revokeObjectURL(url)
    }, [])

    const btnStyle = (active: boolean, color: string) => ({
        padding: '4px 12px',
        borderRadius: 6,
        border: '1px solid #ccc',
        background: active ? color : '#fff',
        color: active ? '#fff' : '#333',
        cursor: 'pointer',
        fontSize: 13,
    })

    const exportBtnStyle = {
        padding: '6px 14px',
        borderRadius: 6,
        border: '1px solid #ccc',
        background: '#228be6',
        color: '#fff',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500 as const,
    }

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20 }}>
            <h1>Noteboard Playground</h1>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <label>Toolbar position:</label>
                {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
                    <button
                        key={pos}
                        onClick={() => setPosition(pos)}
                        style={btnStyle(position === pos, '#6c47ff')}
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
                        style={btnStyle(propertiesPosition === pos, '#e8590c')}
                    >
                        {pos}
                    </button>
                ))}

                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={handleExportPNG} style={exportBtnStyle}>
                        📥 Export PNG
                    </button>
                    <button onClick={handleExportJSON} style={{ ...exportBtnStyle, background: '#40c057' }}>
                        📋 Export JSON
                    </button>
                </span>
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
                    ref={noteboardRef}
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
