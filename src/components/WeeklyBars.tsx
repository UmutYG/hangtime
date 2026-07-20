import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { theme } from '../theme';

/** weekly-km bar chart in the design language; current week highlighted */
export function WeeklyBars({
  data,
  width,
  height = 64,
  showValues = false,
}: {
  data: Array<{ value: number }>;
  width: number;
  height?: number;
  showValues?: boolean;
}) {
  const labelSpace = showValues ? 16 : 0;
  const gap = 6;
  const barW = (width - gap * (data.length - 1)) / data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Svg width={width} height={height + labelSpace}>
      {data.map((d, i) => {
        const h = Math.max(3, (d.value / max) * (height - 6));
        const x = i * (barW + gap);
        const active = i === data.length - 1;
        return (
          <React.Fragment key={i}>
            <Rect
              x={x}
              y={labelSpace + height - h}
              width={barW}
              height={h}
              rx={3}
              fill={active ? theme.run : theme.cardMuted}
              stroke={active ? 'none' : theme.border}
              strokeWidth={active ? 0 : 1}
            />
            {showValues && d.value > 0 ? (
              <SvgText
                x={x + barW / 2}
                y={labelSpace + height - h - 4}
                fontSize={9}
                fill={theme.textFaint}
                textAnchor="middle"
              >
                {d.value}
              </SvgText>
            ) : null}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
