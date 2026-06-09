import {
    PaletteIcon, PaintBucketIcon, LineSegmentIcon, CircleHalfIcon,
    BoundingBoxIcon, CopyIcon,
} from '@phosphor-icons/react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, RectangleElement, BlendMode } from '../../elements/types';
import { isShapeElement, isLinearElement } from '../../elements/types';
import { ColorRow, ChoiceRow, SliderRow, CollapsibleSection, COLOR_SWATCHES_LIGHT, COLOR_SWATCHES_DARK, iconBtnStyle } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    isDark: boolean;
    onUpdate: (updates: Partial<NoteboardElement>) => void;
    onAlignLeft?: () => void;
    onAlignCenterH?: () => void;
    onAlignRight?: () => void;
    onAlignTop?: () => void;
    onAlignCenterV?: () => void;
    onAlignBottom?: () => void;
    onDistributeH?: () => void;
    onDistributeV?: () => void;
}

export function AppearanceSection({
    selectedElements, isDark, onUpdate,
    onAlignLeft, onAlignCenterH, onAlignRight,
    onAlignTop, onAlignCenterV, onAlignBottom,
    onDistributeH, onDistributeV,
}: Props) {
    const theme = useNoteboardTheme();

    const hasShapes = selectedElements.some((el) => isShapeElement(el));
    const hasLinear = selectedElements.some((el) => isLinearElement(el));
    const showFill = hasShapes;
    const showStrokeWidth = hasShapes || hasLinear;
    const showStrokeStyle = hasShapes || hasLinear;
    const isMulti = selectedElements.length > 1;

    const first = selectedElements[0];
    const strokeColor = first?.strokeColor ?? theme.strokeColor;
    const backgroundColor = first?.backgroundColor ?? 'transparent';
    const strokeWidth = first?.strokeWidth ?? 2;
    const strokeStyle = (first?.strokeStyle ?? 'solid') as 'solid' | 'dashed' | 'dotted';
    const opacity = first?.opacity ?? 100;
    const blendMode = (first?.blendMode ?? 'normal') as BlendMode;
    const hasRectangles = selectedElements.some((el) => el.type === 'rectangle');
    const borderRadius = hasRectangles && first?.type === 'rectangle'
        ? (first as RectangleElement).borderRadius ?? 0
        : 0;

    const swatches = isDark ? COLOR_SWATCHES_DARK : COLOR_SWATCHES_LIGHT;
    const ibs = (active = false) => ({ ...iconBtnStyle(theme, active), padding: '5px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 });

    return (
        <CollapsibleSection label="Appearance" theme={theme}>
            <ColorRow
                label="Stroke"
                icon={<PaletteIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                value={strokeColor} swatches={swatches}
                onChange={(c) => onUpdate({ strokeColor: c })}
                theme={theme}
            />

            {showFill && (
                <ColorRow
                    label="Fill"
                    icon={<PaintBucketIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                    value={backgroundColor} swatches={['transparent', ...swatches]}
                    onChange={(c) => onUpdate({ backgroundColor: c })}
                    theme={theme}
                />
            )}

            {showStrokeWidth && (
                <ChoiceRow
                    label="Width"
                    icon={<LineSegmentIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                    options={[
                        { value: '1', label: 'S' }, { value: '2', label: 'M' },
                        { value: '4', label: 'L' }, { value: '6', label: 'XL' },
                    ]}
                    value={String(strokeWidth)}
                    onChange={(v) => onUpdate({ strokeWidth: Number(v) })}
                    theme={theme}
                />
            )}

            {showStrokeStyle && (
                <ChoiceRow
                    label="Line Style"
                    icon={<LineSegmentIcon size={14} weight="bold" style={{ color: theme.panelMutedColor, transform: 'rotate(90deg)' }} />}
                    options={[
                        { value: 'solid', label: '━━' },
                        { value: 'dashed', label: '╌╌' },
                        { value: 'dotted', label: '···' },
                    ]}
                    value={strokeStyle}
                    onChange={(v) => onUpdate({ strokeStyle: v as any })}
                    theme={theme}
                />
            )}

            <SliderRow
                label="Opacity"
                icon={<CircleHalfIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                value={opacity} min={10} max={100} step={5} unit="%"
                onChange={(v) => onUpdate({ opacity: v })}
                theme={theme}
            />

            {/* Blend Mode */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <CopyIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Blend Mode</span>
                </div>
                <select
                    value={blendMode}
                    onChange={(e) => onUpdate({ blendMode: e.target.value as BlendMode })}
                    style={{
                        width: '100%', fontSize: 12, borderRadius: 6, padding: '4px 6px',
                        border: theme.panelBorder, background: theme.panelBg, color: theme.panelTextColor,
                        cursor: 'pointer', outline: 'none',
                    }}
                >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                </select>
            </div>

            {hasRectangles && (
                <SliderRow
                    label="Corner Radius"
                    icon={<BoundingBoxIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                    value={borderRadius} min={0} max={50} step={1} unit="px"
                    onChange={(v) => onUpdate({ borderRadius: v } as any)}
                    theme={theme}
                />
            )}

            {/* Align & Distribute — visible when 2+ elements selected */}
            {isMulti && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Align</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                        <button title="Align left edges"      onClick={onAlignLeft}    style={ibs()}>⇤</button>
                        <button title="Center horizontally"   onClick={onAlignCenterH} style={ibs()}>↔</button>
                        <button title="Align right edges"     onClick={onAlignRight}   style={ibs()}>⇥</button>
                        <button title="Align top edges"       onClick={onAlignTop}     style={ibs()}>⇡</button>
                        <button title="Center vertically"     onClick={onAlignCenterV} style={ibs()}>↕</button>
                        <button title="Align bottom edges"    onClick={onAlignBottom}  style={ibs()}>⇣</button>
                    </div>
                    {selectedElements.length > 2 && (
                        <div style={{ display: 'flex', gap: 3 }}>
                            <button title="Distribute horizontally" onClick={onDistributeH} style={ibs()}>
                                <span style={{ fontSize: 10 }}>⫞⫟ H</span>
                            </button>
                            <button title="Distribute vertically" onClick={onDistributeV} style={ibs()}>
                                <span style={{ fontSize: 10 }}>⫠⫡ V</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </CollapsibleSection>
    );
}
