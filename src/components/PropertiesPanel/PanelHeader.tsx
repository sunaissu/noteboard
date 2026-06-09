import {
    LockSimpleIcon, LockOpenIcon,
    ArrowFatUpIcon, ArrowFatDownIcon, ArrowFatLineUpIcon, ArrowFatLineDownIcon,
    FrameCornersIcon, MinusIcon,
} from '@phosphor-icons/react';
import { useNoteboardTheme } from '../../ThemeContext';
import { iconBtnStyle } from './primitives';

interface Props {
    count: number;
    isLocked: boolean;
    isMultiSelect: boolean;
    onToggleLock?: () => void;
    onBringToFront?: () => void;
    onBringForward?: () => void;
    onSendBackward?: () => void;
    onSendToBack?: () => void;
    onGroup?: () => void;
    onUngroup?: () => void;
}

export function PanelHeader({
    count, isLocked, isMultiSelect,
    onToggleLock, onBringToFront, onBringForward,
    onSendBackward, onSendToBack, onGroup, onUngroup,
}: Props) {
    const theme = useNoteboardTheme();
    const ibs = (active = false) => iconBtnStyle(theme, active);

    return (
        <div style={{ padding: '6px 10px 6px', borderBottom: theme.panelBorder, flexShrink: 0 }}>
            {/* Z-order, group, lock — all in one row */}
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <button onClick={onBringToFront} title="Bring to Front" style={ibs()}><ArrowFatLineUpIcon size={14} /></button>
                <button onClick={onBringForward} title="Bring Forward" style={ibs()}><ArrowFatUpIcon size={14} /></button>
                <button onClick={onSendBackward} title="Send Backward" style={ibs()}><ArrowFatDownIcon size={14} /></button>
                <button onClick={onSendToBack} title="Send to Back" style={ibs()}><ArrowFatLineDownIcon size={14} /></button>
                <div style={{ flex: 1 }} />
                {isMultiSelect && (
                    <button onClick={onGroup} title="Group (Ctrl+G)" style={ibs()}><FrameCornersIcon size={14} /></button>
                )}
                <button onClick={onUngroup} title="Ungroup (Ctrl+Shift+G)" style={ibs()}><MinusIcon size={14} /></button>
                <button onClick={onToggleLock} title={isLocked ? 'Unlock' : 'Lock'} style={ibs(isLocked)}>
                    {isLocked
                        ? <LockSimpleIcon size={14} weight="bold" />
                        : <LockOpenIcon size={14} weight="regular" />
                    }
                </button>
            </div>
        </div>
    );
}
