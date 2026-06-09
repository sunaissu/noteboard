import { Noteboard } from '@sunaissu/noteboard'
import type { Tool, ToolSlot, NoteboardRef, NoteboardViewport } from '@sunaissu/noteboard'
import type { NoteboardTheme } from '@sunaissu/noteboard'
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

const DEFAULT_THEME: Partial<NoteboardTheme> = {}

function App() {
    const [activeTool, setActiveTool] = useState<Tool>('select')
    const [position, setPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')
    const [propertiesPosition, setPropertiesPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('left')
    const [readOnly, setReadOnly] = useState(false)
    const [viewport, setViewport] = useState<NoteboardViewport>({ panX: 0, panY: 0, zoom: 1 })
    const noteboardRef = useRef<NoteboardRef>(null)

    // Theme customisation
    const [themeOpen, setThemeOpen] = useState(false)
    const [canvasBg, setCanvasBg] = useState('#1e1e1e')
    const [strokeColor, setStrokeColor] = useState('#e0e0e0')
    const [panelBg, setPanelBg] = useState('#2a2a2a')

    const customTheme: NoteboardTheme = {
        canvasBg,
        strokeColor,
        textColor: strokeColor,
        toolbarBg: panelBg,
        toolbarShadow: '0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        buttonActiveBg: '#0d47a1',
        buttonActiveColor: '#90caf9',
        buttonHoverBg: '#3a3a3a',
        buttonDefaultColor: '#cccccc',
        badgeColor: '#777777',
        panelBg,
        panelBorder: '1px solid rgba(255,255,255,0.08)',
        panelTextColor: '#e0e0e0',
        panelMutedColor: '#999999',
        textInputColor: strokeColor,
    }

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

    const zoomPct = Math.round(viewport.zoom * 100)

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20 }}>
            <h1>Noteboard Playground</h1>

            {/* Row 1: Toolbar position */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
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

            {/* Row 2: Properties position + export + read-only */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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

                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        onClick={() => setReadOnly((v) => !v)}
                        style={btnStyle(readOnly, '#e03131')}
                    >
                        {readOnly ? '🔒 Read-only: ON' : '✏️ Read-only: OFF'}
                    </button>
                    <button onClick={handleExportPNG} style={exportBtnStyle}>
                        📥 Export PNG
                    </button>
                    <button onClick={handleExportJSON} style={{ ...exportBtnStyle, background: '#40c057' }}>
                        📋 Export JSON
                    </button>
                </span>
            </div>

            {/* Row 3: Zoom controls + Theme picker */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>Zoom:</label>
                <span style={{ minWidth: 44, textAlign: 'center', fontWeight: 600, fontSize: 13 }}>{zoomPct}%</span>
                {[50, 100, 150, 200].map((pct) => (
                    <button
                        key={pct}
                        onClick={() => {
                            // Use the viewport change to drive internal zoom via noteboardRef
                            // We fire a synthetic setZoom by updating initialViewport isn't available,
                            // but we can set elements as a no-op to poke the ref — actual zoom is
                            // controlled via ZoomHUD. Show zoom presets as informational for now.
                            // The canonical approach: expose setZoom via ref in a future version.
                            // For now, just highlight the current zoom.
                        }}
                        style={btnStyle(zoomPct === pct, '#7c5cff')}
                    >
                        {pct}%
                    </button>
                ))}

                <div style={{ marginLeft: 16, position: 'relative' }}>
                    <button
                        onClick={() => setThemeOpen((v) => !v)}
                        style={{ ...exportBtnStyle, background: themeOpen ? '#7c5cff' : '#555' }}
                    >
                        🎨 Theme
                    </button>

                    {themeOpen && (
                        <div style={{
                            position: 'absolute', top: '110%', left: 0, zIndex: 10,
                            background: '#fff', border: '1px solid #ddd', borderRadius: 10,
                            padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                            display: 'flex', flexDirection: 'column', gap: 12, minWidth: 220,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontSize: 13, fontWeight: 500 }}>Canvas background</label>
                                <input type="color" value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)} style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontSize: 13, fontWeight: 500 }}>Stroke / text color</label>
                                <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontSize: 13, fontWeight: 500 }}>Panel / toolbar color</label>
                                <input type="color" value={panelBg} onChange={(e) => setPanelBg(e.target.value)} style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                            </div>
                            <button
                                onClick={() => { setCanvasBg('#1e1e1e'); setStrokeColor('#e0e0e0'); setPanelBg('#2a2a2a'); }}
                                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer', fontSize: 12 }}
                            >
                                Reset to dark defaults
                            </button>
                        </div>
                    )}
                </div>
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
                    readOnly={readOnly}
                    theme={customTheme}
                    onViewportChange={setViewport}
                />
            </div>

            <p style={{ marginTop: 12, color: '#888', fontSize: 14 }}>
                Press keys <kbd>1</kbd>–<kbd>{customSlots.length}</kbd> to switch tools.
                Use the <strong>☰ menu</strong> in the top-right to toggle dark mode.
                Press <kbd>?</kbd> for keyboard shortcuts.
                Right-click on canvas for context menu.
            </p>
        </div>
    )
}

export default App
