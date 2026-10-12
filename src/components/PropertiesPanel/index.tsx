import React, { useEffect, useId, useRef, useState } from 'react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement } from '../../elements/types';
import { hasShapeText } from '../../elements/types';
import type { PropertiesPosition } from '../../types';
import { CaretDownIcon } from '@phosphor-icons/react';

import { PanelHeader } from './PanelHeader';
import { HorizontalProperties } from './primitives';
import { AppearanceSection } from './AppearanceSection';
import { ShadowSection } from './ShadowSection';
import { LineSection } from './LineSection';
import { TextSection } from './TextSection';
import { PenSection } from './PenSection';
import { StarSection } from './StarSection';

export interface PropertiesPanelProps {
    selectedElements: NoteboardElement[];
    onUpdateElements: (updates: Partial<NoteboardElement>) => void;
    onBringForward?: () => void;
    onSendBackward?: () => void;
    onBringToFront?: () => void;
    onSendToBack?: () => void;
    onGroup?: () => void;
    onUngroup?: () => void;
    onToggleLock?: () => void;
    onAlignLeft?: () => void;
    onAlignCenterH?: () => void;
    onAlignRight?: () => void;
    onAlignTop?: () => void;
    onAlignCenterV?: () => void;
    onAlignBottom?: () => void;
    onDistributeH?: () => void;
    onDistributeV?: () => void;
    isDark: boolean;
    position?: PropertiesPosition;
}

function getPanelPosition(pos: PropertiesPosition): React.CSSProperties {
    switch (pos) {
        case 'top':    return { top: 12, left: 'calc(50% - 24px)', transform: 'translateX(-50%)' };
        case 'bottom': return { bottom: 12, left: '50%', transform: 'translateX(-50%)' };
        case 'left':   return { top: 12, left: 12 };
        case 'right':  return { top: 12, right: 12 };
    }
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedElements,
    onUpdateElements,
    onBringForward, onSendBackward, onBringToFront, onSendToBack,
    onGroup, onUngroup, onToggleLock,
    onAlignLeft, onAlignCenterH, onAlignRight,
    onAlignTop, onAlignCenterV, onAlignBottom,
    onDistributeH, onDistributeV,
    isDark,
    position = 'left',
}) => {
    const theme = useNoteboardTheme();
    const hasSelection = selectedElements.length > 0;
    const isHorizontal = position === 'top' || position === 'bottom';

    const hasText = selectedElements.some((el) => el.type === 'text');
    const hasShapesWithText = selectedElements.some((el) => hasShapeText(el));
    const hasArrows = selectedElements.some((el) => el.type === 'arrow');
    const hasLines = selectedElements.some((el) => el.type === 'line');
    const hasPen = selectedElements.some((el) => el.type === 'pen');
    const hasStars = selectedElements.some((el) => el.type === 'star');
    const isMultiSelect = selectedElements.length > 1;
    const isLocked = selectedElements.some((el) => el.locked);

    // Show text section only for standalone text elements or shapes that actually
    // contain text (i.e. the user has typed something into the shape).
    const showTextProps = hasText || hasShapesWithText;
    const showLineProps = hasLines || hasArrows;

    const posStyle = getPanelPosition(position);
    const baseTransform = posStyle.transform ?? '';
    // For side panels (left/right) there is no base transform — scale only
    const combinedTransform = baseTransform
        ? `${baseTransform} ${hasSelection ? '' : 'scale(0.97)'}`
        : (hasSelection ? 'scale(1)' : 'scale(0.97)');
    const [panelCollapsed, setPanelCollapsed] = useState(false);

    const [category, setCategory] = useState('appearance');
    const content = useRef<HTMLDivElement>(null);
    const id = useId();
    const sections = [
        { key: 'appearance', label: 'Appearance', node: <AppearanceSection selectedElements={selectedElements} isDark={isDark} onUpdate={onUpdateElements}
            onAlignLeft={onAlignLeft} onAlignCenterH={onAlignCenterH} onAlignRight={onAlignRight}
            onAlignTop={onAlignTop} onAlignCenterV={onAlignCenterV} onAlignBottom={onAlignBottom}
            onDistributeH={onDistributeH} onDistributeV={onDistributeV} /> },
        ...(showTextProps ? [{ key: 'text', label: 'Text', node: <TextSection selectedElements={selectedElements} onUpdate={onUpdateElements} /> }] : []),
        ...(showLineProps ? [{ key: 'line', label: 'Line / Arrow', node: <LineSection selectedElements={selectedElements} onUpdate={onUpdateElements} /> }] : []),
        { key: 'shadow', label: 'Shadow', node: <ShadowSection selectedElements={selectedElements} onUpdate={onUpdateElements} /> },
        ...(hasPen ? [{ key: 'pen', label: 'Pen', node: <PenSection selectedElements={selectedElements} onUpdate={onUpdateElements} /> }] : []),
        ...(hasStars ? [{ key: 'star', label: 'Star', node: <StarSection selectedElements={selectedElements} onUpdate={onUpdateElements} /> }] : []),
    ];
    const active = sections.some(section => section.key === category) ? category : 'appearance';
    useEffect(() => { if (content.current) { content.current.scrollLeft = 0; content.current.scrollTop = 0; } }, [active, position]);
    const actions = <PanelHeader compact={isHorizontal} isLocked={isLocked} isMultiSelect={isMultiSelect}
        onToggleLock={onToggleLock} onBringToFront={onBringToFront} onBringForward={onBringForward}
        onSendBackward={onSendBackward} onSendToBack={onSendToBack} onGroup={onGroup} onUngroup={onUngroup} />;

    return (
        <div role="region" aria-label="Object properties" data-position={position} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
            style={{ position: 'absolute', ...posStyle, transform: combinedTransform,
                width: isHorizontal ? `min(760px, calc(100% - ${position === 'top' ? 72 : 24}px))` : 226, maxWidth: 'calc(100% - 24px)', zIndex: 1000,
                background: theme.panelBg, borderRadius: 12, boxShadow: theme.toolbarShadow, fontFamily: "'Inter', system-ui, sans-serif",
                pointerEvents: hasSelection ? 'auto' : 'none', visibility: hasSelection ? 'visible' : 'hidden', opacity: hasSelection ? 1 : 0,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                maxHeight: isHorizontal ? 'min(220px, calc(100% - 24px))' : 'calc(100% - 24px)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                padding: '6px 10px', borderBottom: panelCollapsed ? 'none' : theme.panelBorder, flexShrink: 0 }}>
                <button type="button" onClick={() => setPanelCollapsed(value => !value)} aria-expanded={!panelCollapsed}
                    title={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 0', borderRadius: 4, color: theme.panelMutedColor }}>
                    <CaretDownIcon size={11} weight="bold" style={{ transform: panelCollapsed ? 'rotate(-90deg)' : 'none' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em' }}>Properties ({selectedElements.length})</span>
                </button>
                {!panelCollapsed && isHorizontal && actions}
            </div>
            {!panelCollapsed && <>
                {!isHorizontal && actions}
                {isHorizontal && <div role="tablist" aria-label="Property categories" data-scroll-axis="horizontal"
                    style={{ display: 'flex', gap: 4, padding: '4px 10px', overflowX: 'auto', flexShrink: 0, overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}
                    onKeyDown={event => {
                        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault(); event.stopPropagation();
                        const index = sections.findIndex(section => section.key === active);
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : sections.length - 1)) % sections.length;
                        setCategory(sections[next].key);
                        const button = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
                        button?.focus({ preventScroll: true });
                        if (button) {
                            const bounds = button.getBoundingClientRect(), container = event.currentTarget.getBoundingClientRect();
                            if (bounds.left < container.left) event.currentTarget.scrollLeft += bounds.left - container.left;
                            else if (bounds.right > container.right) event.currentTarget.scrollLeft += bounds.right - container.right;
                        }
                    }}>
                    {sections.map(section => <button key={section.key} id={id + '-tab-' + section.key} type="button" role="tab"
                        aria-selected={active === section.key} aria-controls={id + '-panel-' + section.key} tabIndex={active === section.key ? 0 : -1}
                        onClick={() => setCategory(section.key)}
                        style={{ border: 0, borderRadius: 5, padding: '5px 9px', flexShrink: 0, cursor: 'pointer', font: 'inherit', fontSize: 11,
                            background: active === section.key ? theme.buttonActiveBg : 'transparent', color: active === section.key ? theme.buttonActiveColor : theme.panelMutedColor }}>
                        {section.label}
                    </button>)}
                </div>}
                <div ref={content} data-property-scroll data-scroll-axis={isHorizontal ? 'horizontal' : undefined} tabIndex={0} aria-label="Property controls"
                    style={{ padding: isHorizontal ? '8px 12px 2px' : '12px 14px 14px', overflow: 'auto', flex: '1 1 auto', minHeight: 0,
                        overscrollBehavior: 'contain', scrollbarWidth: 'thin', scrollbarColor: theme.panelMutedColor + '44 transparent' }}>
                    <HorizontalProperties.Provider value={isHorizontal}>
                        {sections.map(section => <div key={section.key} id={id + '-panel-' + section.key} hidden={isHorizontal && active !== section.key}
                            role={isHorizontal ? 'tabpanel' : undefined} aria-labelledby={isHorizontal ? id + '-tab-' + section.key : undefined}>
                            {section.node}
                        </div>)}
                    </HorizontalProperties.Provider>
                </div>
            </>}
        </div>
    );
};
