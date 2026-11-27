// Einfache Linien-Icons (selbst gezeichnet mit react-native-svg, kein Icon-Paket noetig).
// Raster 24 x 24, Strichstaerke 2 - wie die ueblichen Icon-Saetze.
import Svg, { Circle, Path } from 'react-native-svg';

export type IconName = 'back' | 'more' | 'edit' | 'copy' | 'plus' | 'check' | 'close' | 'trash' | 'search';

type IconProps = { name: IconName; color: string; size?: number };

export function Icon({ name, color, size = 22 }: IconProps) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' ? <Path d="M15 5 L8 12 L15 19" {...stroke} /> : null}
      {name === 'more' ? (
        <>
          <Circle cx={5} cy={12} r={1.8} fill={color} />
          <Circle cx={12} cy={12} r={1.8} fill={color} />
          <Circle cx={19} cy={12} r={1.8} fill={color} />
        </>
      ) : null}
      {name === 'edit' ? (
        <>
          <Path d="M4 20 H8 L19 9 L15 5 L4 16 Z" {...stroke} />
          <Path d="M13 7 L17 11" {...stroke} />
        </>
      ) : null}
      {name === 'copy' ? (
        <>
          <Path d="M9 9 H19 V19 H9 Z" {...stroke} />
          <Path d="M5 15 V5 H15" {...stroke} />
        </>
      ) : null}
      {name === 'plus' ? <Path d="M12 5 V19 M5 12 H19" {...stroke} /> : null}
      {name === 'check' ? <Path d="M5 12 L10 17 L19 7" {...stroke} /> : null}
      {name === 'trash' ? (
        <>
          <Path d="M4 7 H20 M9 7 V4 H15 V7" {...stroke} />
          <Path d="M6 7 L7 20 H17 L18 7 M10 11 V16 M14 11 V16" {...stroke} />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <Circle cx={11} cy={11} r={6} {...stroke} />
          <Path d="M15.5 15.5 L20 20" {...stroke} />
        </>
      ) : null}
      {name === 'close' ? <Path d="M6 6 L18 18 M18 6 L6 18" {...stroke} /> : null}
    </Svg>
  );
}
